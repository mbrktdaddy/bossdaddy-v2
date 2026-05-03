'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'

const MediaPicker = dynamic(() => import('@/components/media/MediaPicker'), { ssr: false })

interface UsageItem { id: string; title?: string; name?: string; slug: string; status?: string }
interface UsageData {
  products:      { id: string; name: string; slug: string }[]
  guides_hero: UsageItem[]
  reviews_hero:  UsageItem[]
  articles_body: UsageItem[]
  reviews_body:  UsageItem[]
}

interface ProductImage {
  id: string
  url: string
  label: string | null
  alt_text: string | null
  position: number | null
  is_primary: boolean
}

interface Props {
  productId: string
  onPrimaryChange: (url: string | null) => void
}

export function ProductImageGallery({ productId, onPrimaryChange }: Props) {
  const [images, setImages]           = useState<ProductImage[]>([])
  const [loading, setLoading]         = useState(true)
  const [uploading, setUploading]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [showPicker, setShowPicker]   = useState(false)
  const [usageModal, setUsageModal]   = useState<{ img: ProductImage; usage: UsageData } | null>(null)
  const [cascadeDeleting, setCascadeDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/media?product_id=${productId}&limit=40&page=1`)
    const json = await res.json()
    if (res.ok) {
      const sorted = (json.assets ?? []).sort(
        (a: ProductImage, b: ProductImage) =>
          (a.position ?? 999) - (b.position ?? 999),
      )
      setImages(sorted)
    } else {
      setError(json.error ?? 'Failed to load images')
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [productId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true); setError(null)

    // Auto-primary on the first uploaded file IF the gallery was empty
    const startedEmpty = images.length === 0

    const results = await Promise.allSettled(
      files.map(async (file, i) => {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('product_id', productId)
        if (startedEmpty && i === 0) fd.append('is_primary', 'true')
        const res = await fetch('/api/media', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Upload failed')
        return json.asset as ProductImage
      }),
    )

    const succeeded = results
      .filter((r): r is PromiseFulfilledResult<ProductImage> => r.status === 'fulfilled')
      .map((r) => r.value)
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]

    if (succeeded.length) {
      setImages((prev) => [...prev, ...succeeded])
      const primary = succeeded.find((img) => img.is_primary)
      if (primary) onPrimaryChange(primary.url)
    }
    if (failed.length) {
      setError(`${failed.length} of ${files.length} uploads failed: ${failed[0].reason?.message ?? 'unknown error'}`)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSetPrimary(img: ProductImage) {
    const res = await fetch(`/api/media/${img.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_primary: true }),
    })
    if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Failed'); return }
    setImages((prev) => prev.map((i) => ({ ...i, is_primary: i.id === img.id })))
    onPrimaryChange(img.url)
  }

  async function handleLabelChange(img: ProductImage, label: string) {
    await fetch(`/api/media/${img.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label || null }),
    })
    setImages((prev) => prev.map((i) => i.id === img.id ? { ...i, label: label || null } : i))
  }

  async function handleDelete(img: ProductImage) {
    if (!confirm('Remove this image?')) return
    const res = await fetch(`/api/media/${img.id}`, { method: 'DELETE' })
    if (res.status === 409) {
      const j = await res.json()
      if (j.usage) { setUsageModal({ img, usage: j.usage }); return }
    }
    if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Delete failed'); return }
    removeImage(img)
  }

  async function handleCascadeDelete(img: ProductImage) {
    setCascadeDeleting(true)
    const res = await fetch(`/api/media/${img.id}?confirm=true`, { method: 'DELETE' })
    if (res.ok) { removeImage(img); setUsageModal(null) }
    else { const j = await res.json(); setError(j.error ?? 'Delete failed') }
    setCascadeDeleting(false)
  }

  function removeImage(img: ProductImage) {
    const remaining = images.filter((i) => i.id !== img.id)
    setImages(remaining)
    if (img.is_primary) {
      onPrimaryChange(remaining.find((i) => i.is_primary)?.url ?? null)
    }
  }

  async function handlePickFromLibrary(url: string, _altText: string, assetId?: string) {
    setShowPicker(false)
    if (!assetId) { setError('Could not identify selected asset — try uploading directly.'); return }
    setError(null)
    const isPrimary = images.length === 0
    const res = await fetch(`/api/media/${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, is_primary: isPrimary }),
    })
    if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Failed to assign image'); return }
    // Reload gallery so the newly-assigned image appears with correct metadata
    await load()
    if (isPrimary) onPrimaryChange(url)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold text-white">Image Gallery</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-lg transition-colors"
          >
            Pick from library
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-semibold rounded-lg transition-colors"
          >
            {uploading ? 'Uploading…' : '+ Upload'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      <p className="text-xs text-gray-600">
        Upload one or many at once — every image is auto-tagged to this product. Click &quot;Set primary&quot; to choose the product card image.
      </p>

      {showPicker && (
        <MediaPicker
          onSelect={handlePickFromLibrary}
          onClose={() => setShowPicker(false)}
        />
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
          <div className="w-3 h-3 border-2 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
          Loading…
        </div>
      ) : images.length === 0 ? (
        <div className="border-2 border-dashed border-gray-800 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-600">No images yet. Upload one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className={`relative rounded-xl border overflow-hidden bg-gray-950 group ${
                img.is_primary
                  ? 'border-orange-500/60 ring-1 ring-orange-500/30'
                  : 'border-gray-800'
              }`}
            >
              <div className="relative w-full h-28">
                <Image
                  src={img.url}
                  alt={img.alt_text ?? img.label ?? 'Product image'}
                  fill
                  className="object-contain p-2"
                  sizes="(max-width: 640px) 50vw, 33vw"
                />
              </div>

              {img.is_primary && (
                <div className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 bg-orange-600 text-white rounded font-semibold">
                  Primary
                </div>
              )}

              <button
                type="button"
                onClick={() => handleDelete(img)}
                className="absolute top-1.5 right-1.5 p-1 bg-gray-900/80 hover:bg-red-900/80 text-gray-500 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Remove image"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="p-2 space-y-1.5">
                <input
                  type="text"
                  defaultValue={img.label ?? ''}
                  onBlur={(e) => {
                    if (e.target.value !== (img.label ?? '')) handleLabelChange(img, e.target.value)
                  }}
                  placeholder="Label (e.g. front)"
                  className="w-full px-2 py-1 text-xs bg-gray-900 border border-gray-800 rounded text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                {!img.is_primary && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(img)}
                    className="w-full text-[10px] py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded transition-colors"
                  >
                    Set primary
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage-aware delete modal */}
      {usageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div>
              <p className="text-base font-black text-white">This image is in use</p>
              <p className="text-sm text-gray-400 mt-1">
                Deleting will auto-clear hero references. Body mentions can&apos;t be auto-fixed.
              </p>
            </div>

            {[
              ...usageModal.usage.products.map((p) => `Product: ${p.name}`),
              ...usageModal.usage.guides_hero.map((a) => `Guide hero: ${a.title ?? a.slug}`),
              ...usageModal.usage.reviews_hero.map((r) => `Review hero: ${r.title ?? r.slug}`),
            ].map((label, i) => (
              <p key={i} className="text-sm text-gray-300 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                {label} <span className="text-gray-600 text-xs">— will be cleared</span>
              </p>
            ))}

            {(usageModal.usage.articles_body.length > 0 || usageModal.usage.reviews_body.length > 0) && (
              <div className="bg-yellow-950/30 border border-yellow-900/40 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-yellow-400 mb-1">Body mentions — not auto-fixed</p>
                {[...usageModal.usage.articles_body, ...usageModal.usage.reviews_body].map((item) => (
                  <p key={item.id} className="text-xs text-yellow-300/70 truncate">{item.title ?? item.slug}</p>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setUsageModal(null)}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCascadeDelete(usageModal.img)}
                disabled={cascadeDeleting}
                className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {cascadeDeleting ? 'Deleting…' : 'Delete + clear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
