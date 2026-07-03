'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { compressImage } from '@/lib/compress-image'
import { downloadImage } from '@/lib/images/download'

const MediaPicker  = dynamic(() => import('@/components/media/MediaPicker'), { ssr: false })
const ImageCropper = dynamic(() => import('@/components/ui/ImageCropper'),   { ssr: false })

interface Props {
  images: string[]
  onChange: (images: string[]) => void
  label?: string
  aspect?: number
  category?: string
  productId?: string
  max?: number
  helpText?: string
}

// Multi-image gallery field for product-style photos. Same tools as the single
// ProductImageField — MediaPicker (multi-select), ImageCropper, /api/media,
// compressImage, camera capture — but manages an ordered array: add, reorder,
// remove. No AI generation (brand rule: AI imagery is editorial only).
export function GalleryField({
  images, onChange, label = 'Gallery', aspect = 4 / 3, category, productId,
  max = 12, helpText,
}: Props) {
  const [showPicker, setShowPicker]   = useState(false)
  const [pendingCrop, setPendingCrop] = useState<File | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const atMax = images.length >= max

  async function readJsonResponse<T extends Record<string, unknown>>(res: Response, fallback: string): Promise<T> {
    const text = await res.text()
    let parsed: T = {} as T
    try { parsed = text ? (JSON.parse(text) as T) : ({} as T) } catch { /* non-JSON body */ }
    if (!res.ok) {
      const msg = (parsed as { error?: string }).error ?? (text ? text.slice(0, 200) : '')
      throw new Error(msg || fallback || `HTTP ${res.status}`)
    }
    return parsed
  }

  // Append new URLs, de-duping against what's already there and respecting max.
  function append(urls: string[]) {
    const next = [...images]
    for (const u of urls) {
      if (next.length >= max) break
      if (!next.includes(u)) next.push(u)
    }
    onChange(next)
  }

  function removeAt(idx: number) {
    onChange(images.filter((_, i) => i !== idx))
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= images.length) return
    const next = [...images]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  async function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0]
    e.target.value = ''
    if (!raw) return
    const compressed = await compressImage(raw).catch(() => raw)
    setPendingCrop(compressed)
  }

  async function handleCropConfirm(blob: Blob) {
    setPendingCrop(null)
    setUploading(true)
    setError(null)
    try {
      const file = new File([blob], 'photo.webp', { type: 'image/webp' })
      const fd = new FormData()
      fd.append('file', file)
      if (category)  fd.append('category', category)
      if (productId) fd.append('product_id', productId)
      const res = await fetch('/api/media', { method: 'POST', body: fd })
      const json = await readJsonResponse<{ asset?: { url?: string } }>(res, 'Upload failed')
      if (json.asset?.url) append([json.asset.url])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
    setUploading(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-prose-muted">
          {label}
          <span className="text-prose-faint font-normal ml-1.5">{images.length}/{max}</span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading || atMax}
            className="text-xs px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg transition-colors min-h-[36px]"
          >
            {uploading ? 'Uploading…' : '📷 Take Photo'}
          </button>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            disabled={atMax}
            className="text-xs px-3 py-1.5 bg-surface-raised hover:bg-surface disabled:opacity-40 text-prose-muted hover:text-prose rounded-lg transition-colors min-h-[36px]"
          >
            📁 Add from library
          </button>
        </div>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
      />

      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full border-2 border-dashed border-strong rounded-xl p-5 text-center hover:border-accent-border transition-colors"
        >
          <p className="text-sm text-prose-faint">No extra photos yet — add a few angles of the product.</p>
        </button>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map((url, idx) => (
            <div
              key={url}
              className="relative group rounded-lg overflow-hidden border border-strong bg-white"
              style={{ aspectRatio: String(aspect) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-contain" />

              {/* Reorder + remove controls */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 p-1 bg-surface-sunken/80 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="px-1.5 py-0.5 bg-surface-raised hover:bg-surface disabled:opacity-30 text-prose text-xs rounded transition-colors"
                    title="Move earlier"
                  >←</button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === images.length - 1}
                    className="px-1.5 py-0.5 bg-surface-raised hover:bg-surface disabled:opacity-30 text-prose text-xs rounded transition-colors"
                    title="Move later"
                  >→</button>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => downloadImage(url, `gallery-${idx + 1}`)}
                    className="px-1.5 py-0.5 bg-surface-raised hover:bg-surface text-prose-muted hover:text-prose text-xs rounded transition-colors"
                    title="Download"
                  >↓</button>
                  <button
                    type="button"
                    onClick={() => removeAt(idx)}
                    className="px-1.5 py-0.5 bg-surface-raised hover:bg-red-50 text-prose-muted hover:text-red-700 text-xs rounded transition-colors"
                    title="Remove"
                  >✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {helpText && <p className="text-xs text-prose-faint">{helpText}</p>}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-300 rounded-lg px-3 py-2">{error}</p>
      )}

      {showPicker && (
        <MediaPicker
          multi
          onSelect={() => {}}
          onMultiSelect={(items) => { append(items.map((i) => i.url)); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
          defaultCategory={category}
          defaultProductId={productId}
          uploadAspect={aspect}
        />
      )}

      {pendingCrop && (
        <ImageCropper
          file={pendingCrop}
          aspect={aspect}
          onCrop={handleCropConfirm}
          onCancel={() => setPendingCrop(null)}
        />
      )}
    </div>
  )
}
