'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { MERCH_CATEGORIES, MERCH_STATUSES, getMerchDisplayImage, type Merch, type MerchCategory, type MerchStatus } from '@/lib/merch'

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

  const [busy, setBusy]               = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [showPicker, setShowPicker]   = useState(false)
  const [uploading, setUploading]     = useState(false)
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
    if (!file) return
    setUploading(true); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/media', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Upload failed'); setUploading(false); return }
    setImageUrl(json.asset.url)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
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
        <label className="block text-sm text-prose-muted mb-1.5">
          Slug <span className="text-red-600">*</span>
        </label>
        <input
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
        <label className="block text-sm text-prose-muted mb-1.5">
          Name <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Boss Daddy Tee"
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
        />
      </div>

      <div>
        <label className="block text-sm text-prose-muted mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Heavyweight cotton tee with the Boss Daddy mark..."
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Price (USD)</label>
          <input
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
          <label className="block text-sm text-prose-muted mb-1.5">Category</label>
          <select
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
          <label className="block text-sm text-prose-muted mb-1.5">Status</label>
          <select
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
        <label className="block text-sm text-prose-muted mb-1.5">External URL</label>
        <input
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
        <label className="block text-sm text-prose-muted mb-1.5">Position</label>
        <input
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
            <div className={`w-10 h-6 rounded-full transition-colors ${featured ? 'bg-accent' : 'bg-stone-300'}`} />
            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${featured ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
          <div>
            <p className="text-sm text-prose-muted font-medium">Featured</p>
            <p className="text-xs text-prose-faint">Show on homepage strip and end-of-article callouts.</p>
          </div>
        </label>
      </div>

      {/* Image */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-prose">Product Image</p>

        {/* Show effective image — manual override takes priority over Printful default */}
        {(() => {
          const displayImg = imageUrl || (item ? getMerchDisplayImage(item) : null)
          const isPrintfulDefault = !imageUrl && !!item?.default_image_url
          return displayImg ? (
            <div className="space-y-1.5">
              <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-soft bg-surface-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={displayImg} alt={name} className="w-full h-full object-cover" />
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute top-1 right-1 p-1 bg-surface/80 hover:bg-red-50 text-prose-muted hover:text-red-600 rounded transition-colors"
                    title="Clear override image"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {isPrintfulDefault && (
                <p className="text-xs text-prose-faint">
                  Printful default — upload or pick from library to override.
                </p>
              )}
              {imageUrl && (
                <p className="text-xs text-accent-text-soft">
                  Manual override active. Clear it to revert to Printful image.
                </p>
              )}
            </div>
          ) : null
        })()}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="text-xs px-3 py-1.5 bg-surface-raised hover:bg-stone-100 text-prose-muted font-semibold rounded-lg transition-colors"
          >
            📁 Pick from library
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold rounded-lg transition-colors"
          >
            {uploading ? 'Uploading…' : '+ Upload'}
          </button>
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
            onSelect={(url) => { setImageUrl(url); setShowPicker(false) }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>

      {/* Synced image moderation — only shown when Printful has provided images */}
      {item?.images && item.images.length > 0 && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-prose">Synced Images</p>
            <p className="text-xs text-prose-faint mt-0.5">
              Click to toggle which images show on the product page. All images are from Printful — re-syncing won&apos;t remove your choices.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {item.images.map((url, i) => {
              const isEnabled = enabledImages.length === 0 || enabledImages.includes(url)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (enabledImages.length === 0) {
                      // First toggle: start from all-enabled minus this one
                      setEnabledImages(item.images!.filter((u) => u !== url))
                    } else {
                      setEnabledImages((prev) =>
                        prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
                      )
                    }
                  }}
                  className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                    isEnabled ? 'border-accent opacity-100' : 'border-strong opacity-30'
                  }`}
                  title={isEnabled ? 'Click to hide' : 'Click to show'}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                  {!isEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {enabledImages.length > 0 && (
            <button
              type="button"
              onClick={() => setEnabledImages([])}
              className="text-xs text-prose-faint hover:text-accent-text-soft transition-colors"
            >
              Reset — show all images
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
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
            className="px-5 py-2.5 text-red-600 hover:text-red-700 text-sm transition-colors disabled:opacity-40"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  )
}
