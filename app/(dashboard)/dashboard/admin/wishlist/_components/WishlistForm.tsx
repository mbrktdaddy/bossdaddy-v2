'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { WishlistItem, WishlistStatus } from '@/lib/wishlist'
import { STORE_OPTIONS, WISHLIST_STATUS_OPTIONS } from '@/lib/wishlist'
import { ProductImageField } from '@/components/workspace/ProductImageField'
import { GalleryField } from '@/components/workspace/GalleryField'

interface Props {
  item: WishlistItem | null
}

export function WishlistForm({ item }: Props) {
  const router = useRouter()
  const isNew = !item

  const [slug, setSlug]                         = useState(item?.slug ?? '')
  const [title, setTitle]                       = useState(item?.title ?? '')
  const [description, setDescription]           = useState(item?.description ?? '')
  const [imageUrl, setImageUrl]                 = useState(item?.image_url ?? '')
  const [galleryImages, setGalleryImages]       = useState<string[]>(item?.gallery_images ?? [])
  const [affiliateUrl, setAffiliateUrl]         = useState(item?.affiliate_url ?? '')
  const [store, setStore]                       = useState(item?.store ?? '')
  const [customStoreName, setCustomStoreName]   = useState(item?.custom_store_name ?? '')
  const [asin, setAsin]                         = useState(item?.asin ?? '')
  const [status, setStatus]                     = useState<WishlistStatus>(item?.status ?? 'considering')
  const [skipReason, setSkipReason]             = useState(item?.skip_reason ?? '')
  const [estimatedDate, setEstimatedDate]       = useState(item?.estimated_review_date ?? '')
  const [priority, setPriority]                 = useState(String(item?.priority ?? 0))

  const slugEdited = useRef(false)

  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [deleting, setDeleting]     = useState(false)

  // Auto-slug from title on new items (stops once user manually edits slug)
  function handleTitleChange(val: string) {
    setTitle(val)
    if (isNew && !slugEdited.current) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    }
  }

  function handleSlugChange(val: string) {
    slugEdited.current = true
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)

    if (status === 'skipped' && !skipReason.trim()) {
      setError('Skip reason is required when status is "Not Testing".')
      setBusy(false)
      return
    }

    const payload = {
      slug:                   slug.trim().toLowerCase(),
      title:                  title.trim(),
      description:            description.trim() || null,
      image_url:              imageUrl.trim() || null,
      gallery_images:         galleryImages,
      affiliate_url:          affiliateUrl.trim() || null,
      store:                  store || null,
      custom_store_name:      store === 'other' ? (customStoreName.trim() || null) : null,
      asin:                   store === 'amazon' ? (asin.trim() || null) : null,
      status,
      skip_reason:            status === 'skipped' ? (skipReason.trim() || null) : null,
      estimated_review_date:  ['queued','testing'].includes(status) ? (estimatedDate || null) : null,
      priority:               parseInt(priority, 10) || 0,
    }

    try {
      const res = await fetch(
        isNew ? '/api/wishlist' : `/api/wishlist/${item!.id}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      router.push('/dashboard/admin/wishlist')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!item) return
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/wishlist/${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Delete failed')
      }
      router.push('/dashboard/admin/wishlist')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setDeleting(false)
    }
  }

  async function handlePromote() {
    if (!item) return
    if (!confirm(`Promote "${item.title}" to a review draft?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/wishlist/${item.id}/promote`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Promote failed')
      router.push(`/dashboard/reviews/${json.review_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Promote failed')
      setBusy(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 bg-surface-sunken border border-strong rounded-xl text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:border-accent'
  const labelCls = 'block text-xs font-semibold text-prose-muted mb-1.5'

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      {error && (
        <div className="px-4 py-3 bg-danger-bg border border-danger-line rounded-xl text-sm text-danger-ink">
          {error}
        </div>
      )}

      {/* Title + Slug */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="wf-title" className={labelCls}>Title *</label>
          <input id="wf-title" className={inputCls} value={title} onChange={(e) => handleTitleChange(e.target.value)} required placeholder="Weber Spirit II E-310" />
        </div>
        <div>
          <label htmlFor="wf-slug" className={labelCls}>Slug *</label>
          <input id="wf-slug" className={inputCls} value={slug} onChange={(e) => handleSlugChange(e.target.value)} required placeholder="weber-spirit-ii-e310" />
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="wf-description" className={labelCls}>Description</label>
        <textarea
          id="wf-description"
          className={`${inputCls} resize-none`}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why I'm considering this — what I want to find out."
        />
      </div>

      {/* Status */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="wf-status" className={labelCls}>Status *</label>
          <select id="wf-status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as WishlistStatus)}>
            {WISHLIST_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wf-priority" className={labelCls}>Priority (higher = shows first)</label>
          <input id="wf-priority" type="number" className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)} />
        </div>
      </div>

      {/* Skip reason — only when skipped */}
      {status === 'skipped' && (
        <div>
          <label htmlFor="wf-skip-reason" className={labelCls}>Skip Reason * <span className="text-prose-faint font-normal">(shown publicly)</span></label>
          <textarea id="wf-skip-reason" className={`${inputCls} resize-none`} rows={2} value={skipReason} onChange={(e) => setSkipReason(e.target.value)} required placeholder="Not enough differentiation from products I've already reviewed." />
        </div>
      )}

      {/* Estimated review date — queued/testing */}
      {['queued', 'testing'].includes(status) && (
        <div>
          <label htmlFor="wf-estimated-date" className={labelCls}>Estimated Review Date</label>
          <input id="wf-estimated-date" type="date" className={inputCls} value={estimatedDate} onChange={(e) => setEstimatedDate(e.target.value)} />
        </div>
      )}

      {/* Cover image — used by every card, strip, the homepage panel, and SEO.
          Same tools/logic as the review & guide workspaces: Take Photo (mobile
          camera) + Library + preview + crop + remove. */}
      <ProductImageField
        label="Cover Image"
        imageUrl={imageUrl || null}
        onChange={(url) => setImageUrl(url ?? '')}
        helpText="The main photo shown everywhere. Snap the product or pick from your library. Cropped to 4:3."
      />

      {/* Gallery — additional photos shown only on the bench detail page. */}
      <GalleryField
        label="More Photos"
        images={galleryImages}
        onChange={setGalleryImages}
        helpText="Optional extra angles, shown on the item's detail page below the cover."
      />

      {/* Store + Affiliate URL */}
      <div>
        <label htmlFor="wf-store" className={labelCls}>Store</label>
        <select id="wf-store" className={inputCls} value={store} onChange={(e) => setStore(e.target.value)}>
          <option value="">— none —</option>
          {STORE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {store === 'other' && (
        <div>
          <label htmlFor="wf-custom-store" className={labelCls}>Custom Store Name</label>
          <input id="wf-custom-store" className={inputCls} value={customStoreName} onChange={(e) => setCustomStoreName(e.target.value)} placeholder="REI, Costco, etc." />
        </div>
      )}

      {store === 'amazon' && (
        <div>
          <label htmlFor="wf-asin" className={labelCls}>ASIN</label>
          <input id="wf-asin" className={inputCls} value={asin} onChange={(e) => setAsin(e.target.value)} placeholder="B07XXXXXXX" />
        </div>
      )}

      {store && (
        <div>
          <label htmlFor="wf-affiliate-url" className={labelCls}>Affiliate URL</label>
          <input id="wf-affiliate-url" className={inputCls} type="url" value={affiliateUrl} onChange={(e) => setAffiliateUrl(e.target.value)} placeholder="https://..." />
        </div>
      )}

      {/* Linked review (read-only) */}
      {item?.review_id && (
        <div className="px-4 py-3 bg-accent-tint border border-accent-border/50 rounded-xl text-sm">
          <span className="text-accent-text-soft font-semibold">Promoted to review</span>
          <span className="text-prose-muted ml-2">Review ID: {item.review_id}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {busy ? 'Saving…' : isNew ? 'Create Item' : 'Save Changes'}
        </button>

        {!isNew && !item.review_id && (
          <button
            type="button"
            onClick={handlePromote}
            disabled={busy}
            className="px-5 py-2.5 bg-surface-raised hover:bg-surface disabled:opacity-50 border border-strong text-prose text-sm font-semibold rounded-xl transition-colors"
          >
            Promote to Review
          </button>
        )}

        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="ml-auto px-4 py-2.5 text-sm text-danger-ink hover:text-danger-ink disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  )
}
