'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface MediaAsset {
  id: string
  url: string
  filename: string
  alt_text: string | null
  uploaded_by: string | null
  file_size: number | null
  mime_type: string | null
  created_at: string
  product_id: string | null
  label: string | null
  is_primary: boolean
  profiles: { username: string } | null
}

interface Product {
  id: string
  name: string
  slug: string
}

interface UsageItem { id: string; title?: string; name?: string; slug: string; status?: string }
interface UsageData {
  products:      { id: string; name: string; slug: string }[]
  articles_hero: UsageItem[]
  reviews_hero:  UsageItem[]
  articles_body: UsageItem[]
  reviews_body:  UsageItem[]
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AssetCard({
  asset,
  productName,
  onDelete,
  onConfirmDelete,
  onAltSave,
  copiedId,
  onCopy,
}: {
  asset: MediaAsset
  productName: string | null
  onDelete: (id: string) => void
  onConfirmDelete: (id: string) => Promise<void>
  onAltSave: (id: string, alt: string) => void
  copiedId: string | null
  onCopy: (id: string, url: string) => void
}) {
  const [editingAlt, setEditingAlt] = useState(false)
  const [altDraft, setAltDraft] = useState(asset.alt_text ?? '')
  const [deleting, setDeleting] = useState(false)
  const [savingAlt, setSavingAlt] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [generatingAlt, setGeneratingAlt] = useState(false)

  async function handleAIGenerate() {
    setGeneratingAlt(true)
    const res = await fetch('/api/claude/alt-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: asset.url }),
    })
    const json = await res.json()
    if (res.ok && json.alt) {
      setAltDraft(json.alt)
      setEditingAlt(true)
    }
    setGeneratingAlt(false)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    await onConfirmDelete(asset.id)
    // Parent handles success/409 — reset our local state either way
    setDeleting(false)
    setConfirmDelete(false)
  }

  async function handleAltSave() {
    setSavingAlt(true)
    const res = await fetch(`/api/media/${asset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alt_text: altDraft }),
    })
    if (res.ok) {
      onAltSave(asset.id, altDraft)
      setEditingAlt(false)
    }
    setSavingAlt(false)
  }

  return (
    <div className="group relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-950 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt={asset.alt_text ?? asset.filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Product badge overlay */}
        {productName && (
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/70">
            <p className="text-[10px] text-orange-400 font-semibold truncate">
              {asset.is_primary && <span className="text-orange-300">★ </span>}
              {asset.label ? `${asset.label} · ${productName}` : productName}
            </p>
          </div>
        )}

        {/* Hover overlay — copy URL */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={() => onCopy(asset.id, asset.url)}
            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {copiedId === asset.id ? '✓ Copied' : 'Copy URL'}
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-xs text-gray-500 truncate" title={asset.filename}>{asset.filename}</p>

        {/* Alt text */}
        {editingAlt ? (
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={altDraft}
              onChange={(e) => setAltDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAltSave(); if (e.key === 'Escape') setEditingAlt(false) }}
              placeholder="Alt text…"
              className="flex-1 min-w-0 px-2 py-1 bg-gray-950 border border-gray-700 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <button
              onClick={handleAltSave}
              disabled={savingAlt}
              className="px-2 py-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
            >
              {savingAlt ? '…' : 'Save'}
            </button>
            <button onClick={() => setEditingAlt(false)} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded transition-colors">
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setEditingAlt(true)}
              className="flex-1 text-left text-xs text-gray-500 hover:text-gray-300 transition-colors truncate"
              title="Click to edit alt text"
            >
              {asset.alt_text ? asset.alt_text : <span className="italic text-gray-600">Add alt text…</span>}
            </button>
            <button
              onClick={handleAIGenerate}
              disabled={generatingAlt}
              title="Generate alt text with AI"
              className="shrink-0 text-xs px-1.5 py-0.5 bg-blue-950/50 hover:bg-blue-900/60 text-blue-400 rounded transition-colors disabled:opacity-50"
            >
              {generatingAlt ? '…' : '✨ AI'}
            </button>
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex flex-col gap-0.5">
            {asset.profiles?.username && (
              <span className="text-xs text-gray-600">@{asset.profiles.username}</span>
            )}
            {asset.file_size ? (
              <span className="text-xs text-gray-700">{formatBytes(asset.file_size)}</span>
            ) : null}
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              confirmDelete
                ? 'bg-red-900/60 text-red-400 hover:bg-red-800'
                : 'text-gray-600 hover:text-red-400'
            }`}
          >
            {deleting ? '…' : confirmDelete ? 'Confirm delete' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const LIMIT = 40

  // Usage-aware delete state
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [cascadeDeleting, setCascadeDeleting] = useState(false)

  // Product filter
  const [products, setProducts] = useState<Product[]>([])
  const [filterProductId, setFilterProductId] = useState<string>('')

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.ok ? r.json() : { products: [] })
      .then((j) => setProducts(j.products ?? []))
      .catch(() => {})
  }, [])

  const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]))

  const fetchAssets = useCallback(async (p: number, productId: string) => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(p) })
    if (productId) qs.set('product_id', productId)
    const res = await fetch(`/api/media?${qs}`)
    if (res.ok) {
      const json = await res.json()
      setAssets(json.assets)
      setTotal(json.total)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAssets(page, filterProductId) }, [fetchAssets, page, filterProductId])

  function handleFilterChange(productId: string) {
    setFilterProductId(productId)
    setPage(1)
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (!list.length) return
    setUploading(true)
    setUploadError(null)

    const results = await Promise.allSettled(
      list.map(async (file) => {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/media', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Upload failed')
        return json.asset as MediaAsset
      })
    )

    const succeeded = results
      .filter((r): r is PromiseFulfilledResult<MediaAsset> => r.status === 'fulfilled')
      .map((r) => r.value)
    const failed = results.filter((r) => r.status === 'rejected')

    if (succeeded.length) {
      setAssets((prev) => [...succeeded, ...prev])
      setTotal((t) => t + succeeded.length)
    }
    if (failed.length) {
      const reason = (failed[0] as PromiseRejectedResult).reason
      setUploadError(`${failed.length} file(s) failed: ${reason?.message ?? 'Unknown error'}`)
    }
    setUploading(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    uploadFiles(e.dataTransfer.files)
  }

  function handleCopy(id: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function handleDelete(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id))
    setTotal((t) => Math.max(0, t - 1))
  }

  function handleAltSave(id: string, alt: string) {
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, alt_text: alt } : a))
  }

  async function handleConfirmDelete(id: string) {
    const res = await fetch(`/api/media/${id}`, { method: 'DELETE' })
    if (res.ok) {
      handleDelete(id)
      return
    }
    const json = await res.json()
    if (res.status === 409 && json.usage) {
      setPendingDeleteId(id)
      setUsageData(json.usage as UsageData)
    }
    // other errors are silently swallowed — AssetCard will reset its state
  }

  async function handleCascadeDelete() {
    if (!pendingDeleteId) return
    setCascadeDeleting(true)
    const res = await fetch(`/api/media/${pendingDeleteId}?confirm=true`, { method: 'DELETE' })
    if (res.ok) handleDelete(pendingDeleteId)
    setCascadeDeleting(false)
    setPendingDeleteId(null)
    setUsageData(null)
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="p-4 sm:p-8 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black">Media Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} asset{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Product filter */}
          {products.length > 0 && (
            <select
              value={filterProductId}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All images</option>
              <option value="__none__">Unassigned only</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {uploading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload
              </>
            )}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {uploadError && (
        <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 mb-4">
          {uploadError}
        </p>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`${dragOver ? 'ring-2 ring-orange-500 ring-inset' : ''} rounded-2xl transition-all`}
      >
        {loading ? (
          <div className="flex items-center gap-3 text-gray-500 py-16 justify-center">
            <div className="w-5 h-5 border-2 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
            Loading…
          </div>
        ) : assets.length === 0 ? (
          <div
            className="border-2 border-dashed border-gray-700 rounded-2xl py-20 flex flex-col items-center gap-3 text-gray-600 cursor-pointer hover:border-gray-600 hover:text-gray-500 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">
              {filterProductId ? 'No images match this filter' : 'Drop images here or click to upload'}
            </p>
            {!filterProductId && <p className="text-xs">JPEG, PNG, WebP, GIF · max 8 MB each</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                productName={asset.product_id ? (productMap[asset.product_id] ?? null) : null}
                onDelete={handleDelete}
                onConfirmDelete={handleConfirmDelete}
                onAltSave={handleAltSave}
                copiedId={copiedId}
                onCopy={handleCopy}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-sm text-white rounded-lg transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-sm text-white rounded-lg transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      {/* Drag-over overlay */}
      {dragOver && (
        <div className="fixed inset-0 bg-black/50 border-4 border-dashed border-orange-500 pointer-events-none z-50 flex items-center justify-center">
          <p className="text-white text-xl font-black">Drop to upload</p>
        </div>
      )}

      {/* Usage-aware delete modal */}
      {usageData && pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5">
            <div>
              <p className="text-base font-black text-white">This image is in use</p>
              <p className="text-sm text-gray-400 mt-1">
                Deleting will auto-clear the hero image on the items below. Body mentions can&apos;t be auto-fixed.
              </p>
            </div>

            {usageData.products.length > 0 && (
              <UsageSection
                label="Product hero"
                items={usageData.products.map((p) => ({ id: p.id, label: p.name, href: `/dashboard/admin/products/${p.id}` }))}
                note="image_url will be cleared"
              />
            )}
            {usageData.articles_hero.length > 0 && (
              <UsageSection
                label="Guide hero"
                items={usageData.articles_hero.map((a) => ({ id: a.id, label: a.title ?? a.slug, href: `/dashboard/articles/${a.id}`, status: a.status }))}
                note="hero image will be cleared"
              />
            )}
            {usageData.reviews_hero.length > 0 && (
              <UsageSection
                label="Review hero"
                items={usageData.reviews_hero.map((r) => ({ id: r.id, label: r.title ?? r.slug, href: `/dashboard/reviews/${r.id}`, status: r.status }))}
                note="hero image will be cleared"
              />
            )}
            {(usageData.articles_body.length > 0 || usageData.reviews_body.length > 0) && (
              <div className="bg-yellow-950/30 border border-yellow-900/40 rounded-xl px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-yellow-400">Body mentions — not auto-fixed</p>
                {[...usageData.articles_body, ...usageData.reviews_body].map((item) => (
                  <p key={item.id} className="text-xs text-yellow-300/70 truncate">{item.title ?? item.slug}</p>
                ))}
                <p className="text-xs text-yellow-500 mt-1">These inline images will be broken after deletion. Edit those pages to remove them.</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setPendingDeleteId(null); setUsageData(null) }}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCascadeDelete}
                disabled={cascadeDeleting}
                className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {cascadeDeleting ? 'Deleting…' : 'Delete + clear references'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function UsageSection({
  label, items, note,
}: {
  label: string
  items: { id: string; label: string; href: string; status?: string }[]
  note: string
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg">
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white hover:text-orange-400 truncate transition-colors"
          >
            {item.label}
          </a>
          <div className="flex items-center gap-2 shrink-0">
            {item.status && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500">{item.status}</span>
            )}
            <span className="text-[10px] text-gray-600">{note}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
