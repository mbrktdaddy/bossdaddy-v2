'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { compressImage } from '@/lib/compress-image'
import { fetchAssetAsFile } from '@/lib/images/derive-crop'
import { downloadImage } from '@/lib/images/download'

const MediaPicker  = dynamic(() => import('@/components/media/MediaPicker'), { ssr: false })
const ImageCropper = dynamic(() => import('@/components/ui/ImageCropper'),   { ssr: false })

interface Props {
  imageUrl: string | null
  onChange: (url: string | null) => void
  label?: string
  /** Crop/upload aspect ratio (w/h). Bench + product photos default to 4:3. */
  aspect?: number
  /** Tags new uploads + seeds the library filter. Pass the category SLUG. */
  category?: string
  productId?: string
  helpText?: string
}

// Single-image field for product-style photos (bench items, products).
// Reuses the SAME tools as the review/guide HeroImagePanel — MediaPicker,
// ImageCropper, /api/media, compressImage, mobile camera capture — but tuned
// for products: 4:3 by default and NO AI generation (brand rule: AI imagery is
// editorial scenes only, never products). Take Photo + Library + preview +
// Crop + Remove, so adding/editing a bench image works the same everywhere.
export function ProductImageField({
  imageUrl, onChange, label = 'Image', aspect = 4 / 3, category, productId,
  helpText,
}: Props) {
  const [showPicker, setShowPicker]   = useState(false)
  const [pendingCrop, setPendingCrop] = useState<File | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Read text first, try-parse, fall back to a readable error — mirrors
  // HeroImagePanel so a non-JSON error body (serverless timeout, HTML page)
  // doesn't surface as "Unexpected token 'A'…".
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

  async function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0]
    e.target.value = ''
    if (!raw) return
    // Compress before cropping so a 12MP phone shot doesn't choke the cropper.
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
      onChange(json.asset?.url ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
    setUploading(false)
  }

  // Reframe the current image (library or uploaded) at the same aspect. Uploads
  // a NEW derived asset — the source URL is never mutated.
  async function handleCropExisting() {
    if (!imageUrl) return
    setError(null)
    try {
      const file = await fetchAssetAsFile(imageUrl)
      setPendingCrop(file)
    } catch {
      setError('Could not load image for cropping — try again')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-prose-muted">{label}</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="text-xs px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg transition-colors min-h-[36px]"
          >
            {uploading ? 'Uploading…' : '📷 Take Photo'}
          </button>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="text-xs px-3 py-1.5 bg-surface-raised hover:bg-surface text-prose-muted hover:text-prose rounded-lg transition-colors min-h-[36px]"
          >
            📁 Library
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

      {imageUrl ? (
        <div className="relative group">
          <div
            className="w-full bg-white rounded-xl border border-strong overflow-hidden"
            style={{ aspectRatio: String(aspect) }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Selected" className="w-full h-full object-contain" />
          </div>
          <button
            type="button"
            onClick={handleCropExisting}
            disabled={uploading}
            className="absolute top-2 left-2 px-2.5 py-1.5 bg-surface/80 hover:bg-surface text-prose-muted hover:text-prose text-xs font-semibold rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
            title="Crop this image"
          >
            Crop
          </button>
          <button
            type="button"
            onClick={() => downloadImage(imageUrl)}
            className="absolute bottom-2 left-2 px-2.5 py-1.5 bg-surface/80 hover:bg-surface text-prose-muted hover:text-prose text-xs font-semibold rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Download this image"
          >
            Download
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 p-1.5 bg-surface/80 hover:bg-red-50 text-prose-muted hover:text-red-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Remove image"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full border-2 border-dashed border-strong rounded-xl p-6 text-center hover:border-accent-border transition-colors"
        >
          <svg className="w-8 h-8 text-prose-faint mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-prose-faint">No image yet — Take Photo or pick from library</p>
        </button>
      )}

      {helpText && <p className="text-xs text-prose-faint">{helpText}</p>}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-300 rounded-lg px-3 py-2">{error}</p>
      )}

      {showPicker && (
        <MediaPicker
          onSelect={(url) => { onChange(url); setShowPicker(false) }}
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
