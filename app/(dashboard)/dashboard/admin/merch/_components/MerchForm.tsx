'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
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
        <label className="block text-sm text-gray-300 mb-1.5">
          Slug <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          pattern="[a-z0-9-]+"
          placeholder="boss-daddy-tee"
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <p className="mt-1 text-xs text-gray-600">
          URL identifier — lowercase letters, numbers, hyphens only.
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1.5">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Boss Daddy Tee"
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Heavyweight cotton tee with the Boss Daddy mark..."
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Price (USD)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={priceDollars}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="28.00"
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as MerchCategory | '')}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">— none —</option>
            {MERCH_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MerchStatus)}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {MERCH_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1.5">External URL</label>
        <input
          type="url"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://shop.bossdaddylife.com/products/..."
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <p className="mt-1 text-xs text-gray-600">
          Where the &quot;Buy&quot; button sends the customer when status is <code className="text-orange-400">available</code>. Leave blank for coming-soon items.
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Position</label>
        <input
          type="number"
          min="0"
          step="1"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="w-32 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <p className="mt-1 text-xs text-gray-600">Lower numbers display first.</p>
      </div>

      {/* Image */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-white">Product Image</p>
        {imageUrl && (
          <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => setImageUrl('')}
              className="absolute top-1 right-1 p-1 bg-gray-900/80 hover:bg-red-900/80 text-gray-400 hover:text-red-400 rounded transition-colors"
              title="Clear image"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-lg transition-colors"
          >
            📁 Pick from library
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-semibold rounded-lg transition-colors"
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

      {error && (
        <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy || !slug.trim() || !name.trim()}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {busy ? 'Saving…' : isNew ? 'Create item' : 'Save changes'}
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-5 py-2.5 text-red-400 hover:text-red-300 text-sm transition-colors disabled:opacity-40"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  )
}
