'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { compressImage } from '@/lib/compress-image'
import ImageCropper from '@/components/ui/ImageCropper'
import { MERCH_CATEGORIES, MERCH_STATUSES, type Merch, type MerchCategory, type MerchStatus } from '@/lib/merch'

const MediaPicker = dynamic(() => import('@/components/media/MediaPicker'), { ssr: false })

interface Props {
  item: Merch | null
}

export function MerchForm({ item }: Props) {
  const router = useRouter()
  const isNew = !item

  const [slug, setSlug]               = useState(item?.slug ?? '')
  const [name, setName]               = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [priceDollars, setPrice]      = useState<string>(
    item?.price_cents != null ? (item.price_cents / 100).toFixed(2) : ''
  )
  const [imageUrl, setImageUrl]       = useState(item?.image_url ?? '')
  const [category, setCategory]       = useState<MerchCategory | ''>(
    (item?.category as MerchCategory) ?? ''
  )
  const [status, setStatus]           = useState<MerchStatus>(item?.status ?? 'coming_soon')
  const [externalUrl, setExternalUrl] = useState(item?.external_url ?? '')
  const [position, setPosition]       = useState<number>(item?.position ?? 0)
  const [featured, setFeatured]       = useState(item?.featured ?? false)
  const [enabledImages, setEnabledImages] = useState<string[]>(item?.enabled_images ?? [])
  const [images, setImages]           = useState<string[]>(item?.images ?? [])

  const [busy, setBusy]               = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [showPicker, setShowPicker]   = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [cropPending, setCropPending] = useState<File | null>(null)
  const fileInputRef                  = useRef<HTMLInputElement>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)

    const dollars = priceDollars.trim() === '' ? null : Number(priceDollars)
    const priceCents = dollars == null ? null : Math.round(dollars * 100)
    if (priceCents != null && (Number.isNaN(priceCents) || priceCents < 0)) {
      setError('Price must be a non-negative number')
      setBusy(false)
      return
    }

    const payload = {
      slug:         slug.trim().toLowerCase(),
      name:         name.trim(),
      description:  description.trim() || null,
      price_cents:  priceCents,
      image_url:    imageUrl.trim() || null,
      category:     category || null,
      status,
      external_url: externalUrl.trim() || null,
      position:     Number.isFinite(position) ? position : 0,
      featured,
      enabled_images: enabledImages,
      images,
    }

    try {
      const res = await fetch(
        isNew ? '/api/admin/merch' : `/api/admin/merch/${item!.id}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      router.push('/dashboard/admin/merch')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setBusy(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    setError(null)
    // Compress, then crop to square before upload.
    const compressed = await compressImage(file).catch(() => file)
    setCropPending(compressed)
  }

  async function doUpload(file: File) {
    setUploading(true); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/media', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Upload failed'); setUploading(false); return }
    addImage(json.asset.url, true)
    setUploading(false)
  }

  // Add an image to the gallery (dedup); optionally make it the primary/thumbnail.
  function addImage(url: string, makePrimary = false) {
    setImages((prev) => (prev.includes(url) ? prev : [...prev, url]))
    if (makePrimary) setImageUrl(url)
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url))
    setEnabledImages((prev) => prev.filter((u) => u !== url))
    if (imageUrl === url) setImageUrl('')
  }

  function toggleEnabled(url: string) {
    // enabledImages empty = "all shown"; first hide seeds the explicit set.
    if (enabledImages.length === 0) {
      setEnabledImages(images.filter((u) => u !== url))
    } else {
      setEnabledImages((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]))
    }
  }

  function handleCropDone(blob: Blob) {
    setCropPending(null)
    doUpload(new File([blob], 'crop.webp', { type: 'image/webp' }))
  }

  async function handleDelete() {
    if (!item) return
    if (!confirm(`Delete "${item.name}" from merch? This cannot be undone.`)) return
    setDeleting(true); setError(null)
    try {
      const res = await fetch(`/api/admin/merch/${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Delete failed')
      }
      router.push('/dashboard/admin/merch')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">

      <div>
        <label htmlFor="mf-slug" className="block text-sm text-prose-muted mb-1.5">
          Slug <span className="text-danger-ink">*</span>
        </label>
        <input
          id="mf-slug"
          type="text"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          pattern="[a-z0-9-]+"
          placeholder="boss-daddy-tee"
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
        />
        <p className="mt-1 text-xs text-prose-faint">
          URL identifier — lowercase letters, numbers, hyphens only.
        </p>
      </div>

      <div>
        <label htmlFor="mf-name" className="block text-sm text-prose-muted mb-1.5">
          Name <span className="text-danger-ink">*</span>
        </label>
        <input
          id="mf-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Boss Daddy Tee"
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
        />
      </div>

      <div>
        <label htmlFor="mf-description" className="block text-sm text-prose-muted mb-1.5">Description</label>
        <textarea
          id="mf-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Heavyweight cotton tee with the Boss Daddy mark..."
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="mf-price" className="block text-sm text-prose-muted mb-1.5">Price (USD)</label>
          <input
            id="mf-price"
            type="number"
            step="0.01"
            min="0"
            value={priceDollars}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="28.00"
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
          />
        </div>
        <div>
          <label htmlFor="mf-category" className="block text-sm text-prose-muted mb-1.5">Category</label>
          <select
            id="mf-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as MerchCategory | '')}
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
          >
            <option value="">— none —</option>
            {MERCH_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="mf-status" className="block text-sm text-prose-muted mb-1.5">Status</label>
          <select
            id="mf-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as MerchStatus)}
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
          >
            {MERCH_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="mf-external-url" className="block text-sm text-prose-muted mb-1.5">External URL</label>
        <input
          id="mf-external-url"
          type="url"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://amazon.com/dp/..."
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
        />
        <p className="mt-1 text-xs text-prose-faint">
          Leave blank for Printful items — native checkout handles those automatically. Only fill this in to bypass checkout and send customers to an external site (e.g. Amazon, a partner store).
        </p>
      </div>

      <div>
        <label htmlFor="mf-position" className="block text-sm text-prose-muted mb-1.5">Position</label>
        <input
          id="mf-position"
          type="number"
          min="0"
          step="1"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="w-32 px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
        />
        <p className="mt-1 text-xs text-prose-faint">Lower numbers display first.</p>
      </div>

      <div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-10 h-6 rounded-full transition-colors ${featured ? 'bg-accent' : 'bg-zinc-600'}`} />
            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${featured ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
          <div>
            <p className="text-sm text-prose-muted font-medium">Featured</p>
            <p className="text-xs text-prose-faint">Show on homepage strip and end-of-article callouts.</p>
          </div>
        </label>
      </div>

      {/* Product images — set primary (thumbnail), show/hide on the page, remove */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-prose">Product Images</p>
          <p className="text-xs text-prose-faint mt-0.5">
            The <span className="text-accent-text-soft font-semibold">primary</span> image is the card thumbnail. Hide any you don&apos;t want on the product page, or remove them entirely. Mockups generated in Merch Studio land here.
          </p>
        </div>

        {images.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {images.map((url, i) => {
              const isPrimary = imageUrl === url || (!imageUrl && i === 0 && !item?.default_image_url)
              const isEnabled = enabledImages.length === 0 || enabledImages.includes(url)
              return (
                <div key={url} className="w-28">
                  <div className={`relative w-28 h-28 rounded-xl overflow-hidden border-2 ${isPrimary ? 'border-accent' : 'border-soft'} ${isEnabled ? 'opacity-100' : 'opacity-40'} bg-surface-sunken`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                    {isPrimary && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-accent text-white text-[10px] font-bold uppercase tracking-wide">Primary</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute top-1 right-1 p-1 bg-surface/80 hover:bg-danger-bg text-prose-muted hover:text-danger-ink rounded transition-colors"
                      title="Remove image"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {!isPrimary && (
                      <button type="button" onClick={() => setImageUrl(url)} className="text-[11px] text-accent-text-soft hover:underline">
                        Set primary
                      </button>
                    )}
                    <button type="button" onClick={() => toggleEnabled(url)} className="text-[11px] text-prose-faint hover:text-prose-muted">
                      {isEnabled ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-prose-faint">
            No images yet{item?.default_image_url ? ' beyond the Printful thumbnail' : ''}. Generate a mockup in Merch Studio, or add one below.
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="text-xs px-3 py-1.5 bg-surface-raised hover:bg-surface text-prose-muted font-semibold rounded-lg transition-colors"
          >
            Pick from library
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold rounded-lg transition-colors"
          >
            {uploading ? 'Uploading…' : '+ Add image'}
          </button>
          {imageUrl && (
            <button
              type="button"
              onClick={() => setImageUrl('')}
              className="text-xs text-prose-faint hover:text-accent-text-soft transition-colors"
            >
              Clear primary (use Printful thumbnail)
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleUpload}
        />
        {showPicker && (
          <MediaPicker
            onSelect={(url) => { addImage(url, true); setShowPicker(false) }}
            onClose={() => setShowPicker(false)}
            uploadAspect={1}
          />
        )}
        {cropPending && (
          <ImageCropper
            file={cropPending}
            aspect={1}
            onCrop={handleCropDone}
            onCancel={() => setCropPending(null)}
          />
        )}
      </div>

      {error && (
        <p className="text-danger-ink text-sm bg-danger-bg border border-danger-line rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy || !slug.trim() || !name.trim()}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {busy ? 'Saving…' : isNew ? 'Create item' : 'Save changes'}
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-5 py-2.5 text-danger-ink hover:text-danger-ink text-sm transition-colors disabled:opacity-40"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  )
}
