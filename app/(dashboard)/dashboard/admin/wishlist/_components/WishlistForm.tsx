'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { WishlistItem, WishlistStatus } from '@/lib/wishlist'
import { STORE_OPTIONS, WISHLIST_STATUS_OPTIONS } from '@/lib/wishlist'

const MediaPicker = dynamic(() => import('@/components/media/MediaPicker'), { ssr: false })

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
  const [showPicker, setShowPicker] = useState(false)

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

  const inputCls = 'w-full px-3 py-2.5 bg-gray-950 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-600'
  const labelCls = 'block text-xs font-semibold text-gray-400 mb-1.5'

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      {error && (
        <div className="px-4 py-3 bg-red-950/40 border border-red-800 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Title + Slug */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Title *</label>
          <input className={inputCls} value={title} onChange={(e) => handleTitleChange(e.target.value)} required placeholder="Weber Spirit II E-310" />
        </div>
        <div>
          <label className={labelCls}>Slug *</label>
          <input className={inputCls} value={slug} onChange={(e) => handleSlugChange(e.target.value)} required placeholder="weber-spirit-ii-e310" />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <textarea
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
          <label className={labelCls}>Status *</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as WishlistStatus)}>
            {WISHLIST_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Priority (higher = shows first)</label>
          <input type="number" className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)} />
        </div>
      </div>

      {/* Skip reason — only when skipped */}
      {status === 'skipped' && (
        <div>
          <label className={labelCls}>Skip Reason * <span className="text-gray-500 font-normal">(shown publicly)</span></label>
          <textarea className={`${inputCls} resize-none`} rows={2} value={skipReason} onChange={(e) => setSkipReason(e.target.value)} required placeholder="Not enough differentiation from products I've already reviewed." />
        </div>
      )}

      {/* Estimated review date — queued/testing */}
      {['queued', 'testing'].includes(status) && (
        <div>
          <label className={labelCls}>Estimated Review Date</label>
          <input type="date" className={inputCls} value={estimatedDate} onChange={(e) => setEstimatedDate(e.target.value)} />
        </div>
      )}

      {/* Image */}
      <div>
        <label className={labelCls}>Image</label>
        <div className="flex gap-2">
          <input className={`${inputCls} flex-1`} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
          <button type="button" onClick={() => setShowPicker(true)} className="shrink-0 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm text-gray-300 transition-colors">
            Library
          </button>
        </div>
        {showPicker && (
          <MediaPicker
            onSelect={(url) => { setImageUrl(url); setShowPicker(false) }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>

      {/* Store + Affiliate URL */}
      <div>
        <label className={labelCls}>Store</label>
        <select className={inputCls} value={store} onChange={(e) => setStore(e.target.value)}>
          <option value="">— none —</option>
          {STORE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {store === 'other' && (
        <div>
          <label className={labelCls}>Custom Store Name</label>
          <input className={inputCls} value={customStoreName} onChange={(e) => setCustomStoreName(e.target.value)} placeholder="REI, Costco, etc." />
        </div>
      )}

      {store === 'amazon' && (
        <div>
          <label className={labelCls}>ASIN</label>
          <input className={inputCls} value={asin} onChange={(e) => setAsin(e.target.value)} placeholder="B07XXXXXXX" />
        </div>
      )}

      {store && (
        <div>
          <label className={labelCls}>Affiliate URL</label>
          <input className={inputCls} type="url" value={affiliateUrl} onChange={(e) => setAffiliateUrl(e.target.value)} placeholder="https://..." />
        </div>
      )}

      {/* Linked review (read-only) */}
      {item?.review_id && (
        <div className="px-4 py-3 bg-orange-950/30 border border-orange-800/50 rounded-xl text-sm">
          <span className="text-orange-400 font-semibold">Promoted to review</span>
          <span className="text-gray-400 ml-2">Review ID: {item.review_id}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {busy ? 'Saving…' : isNew ? 'Create Item' : 'Save Changes'}
        </button>

        {!isNew && !item.review_id && (
          <button
            type="button"
            onClick={handlePromote}
            disabled={busy}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Promote to Review
          </button>
        )}

        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="ml-auto px-4 py-2.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  )
}
