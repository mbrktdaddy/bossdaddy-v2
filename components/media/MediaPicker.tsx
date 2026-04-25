'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface MediaAsset {
  id: string
  url: string
  filename: string
  alt_text: string | null
  file_size: number | null
  product_id: string | null
  label: string | null
  is_primary: boolean
}

interface Product {
  id: string
  name: string
  slug: string
}

interface MediaPickerProps {
  onSelect: (url: string, altText: string, assetId?: string) => void
  onClose: () => void
  defaultProductId?: string
  defaultCategory?: string
}

type Tab = 'library' | 'generate'

export default function MediaPicker({ onSelect, onClose, defaultProductId, defaultCategory }: MediaPickerProps) {
  const [tab, setTab] = useState<Tab>('library')

  // Library state
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Product filter — pre-seeded from caller context
  const [products, setProducts] = useState<Product[]>([])
  const [filterProductId, setFilterProductId] = useState<string>(defaultProductId ?? '')

  // Generate state
  const [genPrompt, setGenPrompt] = useState('')
  const [genSize, setGenSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1792x1024')
  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const LIMIT = 40

  // Client-side search filter across filename, label, alt_text
  const filteredAssets = searchQuery.trim()
    ? assets.filter((a) => {
        const q = searchQuery.toLowerCase()
        return (
          a.filename.toLowerCase().includes(q) ||
          (a.label ?? '').toLowerCase().includes(q) ||
          (a.alt_text ?? '').toLowerCase().includes(q)
        )
      })
    : assets

  // Fetch products for the filter dropdown once
  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.ok ? r.json() : { products: [] })
      .then((j) => setProducts(j.products ?? []))
      .catch(() => {})
  }, [])

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Reset to page 1 when filter changes
  function handleFilterChange(productId: string) {
    setFilterProductId(productId)
    setPage(1)
    setSelected(null)
    setSearchQuery('')
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (!list.length) return
    setUploading(true); setUploadError(null)

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
      setSelected(succeeded[0].url)
    }
    if (failed.length) {
      const reason = (failed[0] as PromiseRejectedResult).reason
      setUploadError(`Upload failed: ${reason?.message ?? 'Unknown error'}`)
    }
    setUploading(false)
  }

  async function handleGenerate() {
    if (!genPrompt.trim()) { setGenError('Enter a prompt first'); return }
    setGenLoading(true); setGenError(null)
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: genPrompt.trim(), size: genSize }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generation failed')
      const newAsset: MediaAsset = {
        id: json.asset.id ?? `gen-${Date.now()}`,
        url: json.asset.url,
        filename: json.asset.filename ?? 'generated.png',
        alt_text: json.asset.alt_text ?? null,
        file_size: null,
        product_id: null,
        label: null,
        is_primary: false,
      }
      setAssets((prev) => [newAsset, ...prev])
      setTotal((t) => t + 1)
      setSelected(newAsset.url)
      setTab('library')
      setGenPrompt('')
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed')
    }
    setGenLoading(false)
  }

  function handleConfirm() {
    if (!selected) return
    const asset = assets.find((a) => a.url === selected)
    onSelect(selected, asset?.alt_text ?? '', asset?.id)
  }

  const totalPages = Math.ceil(total / LIMIT)

  // Map product_id → name for badge display
  const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setTab('library')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                tab === 'library' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Library
            </button>
            <button
              type="button"
              onClick={() => setTab('generate')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                tab === 'generate' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Generate
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            {tab === 'library' && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…"
                className="w-28 sm:w-36 px-2 py-1.5 bg-gray-800 border border-gray-700 text-xs text-gray-300 placeholder-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            )}
            {/* Product filter */}
            {tab === 'library' && products.length > 0 && (
              <select
                value={filterProductId}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="px-2 py-1.5 bg-gray-800 border border-gray-700 text-xs text-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="">All images</option>
                <option value="__none__">Unassigned only</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            {tab === 'library' && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {uploading ? (
                  <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
                Upload
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-gray-800">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
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

        {uploadError && tab === 'library' && (
          <p className="text-red-400 text-xs bg-red-950/50 border-b border-red-900/40 px-5 py-2.5 shrink-0">{uploadError}</p>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'library' ? (
            loading ? (
              <div className="flex items-center justify-center gap-2 text-gray-500 py-16">
                <div className="w-4 h-4 border-2 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
                Loading…
              </div>
            ) : filteredAssets.length === 0 ? (
              <div
                className="border-2 border-dashed border-gray-700 rounded-xl py-16 flex flex-col items-center gap-2 text-gray-600 cursor-pointer hover:border-gray-600 transition-colors"
                onClick={() => !searchQuery && setTab('generate')}
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">
                  {searchQuery ? `No images match "${searchQuery}"` : filterProductId ? 'No images for this product yet' : 'No images yet — click to generate one'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {filteredAssets.map((asset) => {
                  const productName = asset.product_id ? productMap[asset.product_id] : null
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setSelected(asset.url === selected ? null : asset.url)}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                        selected === asset.url
                          ? 'border-orange-500 ring-2 ring-orange-500/30'
                          : 'border-transparent hover:border-gray-600'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.url} alt={asset.alt_text ?? asset.filename} className="w-full h-full object-cover" loading="lazy" />

                      {selected === asset.url && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}

                      {/* Product badge */}
                      {productName && (
                        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-black/70">
                          <p className="text-[9px] text-orange-400 font-semibold truncate leading-tight">
                            {asset.is_primary && <span className="text-orange-300">★ </span>}
                            {asset.label ?? productName}
                          </p>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          ) : (
            /* Generate tab */
            <div className="space-y-4 max-w-2xl mx-auto">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Prompt</label>
                <textarea
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                  rows={5}
                  placeholder="Describe the image — include subject, setting, lighting, style. Example: 'a DeWalt cordless drill on a wooden workbench, warm natural light, editorial photography, no people, no text'"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Aspect ratio</label>
                <div className="flex gap-2">
                  {[
                    { value: '1792x1024', label: 'Landscape', ratio: '16:9' },
                    { value: '1024x1024', label: 'Square',    ratio: '1:1' },
                    { value: '1024x1792', label: 'Portrait',  ratio: '9:16' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setGenSize(opt.value as typeof genSize)}
                      className={`flex-1 flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors ${
                        genSize === opt.value ? 'bg-orange-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-xs font-semibold">{opt.label}</span>
                      <span className="text-xs opacity-70 font-mono">{opt.ratio}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={genLoading || !genPrompt.trim()}
                className="w-full px-5 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
              >
                {genLoading ? 'Generating…' : 'Generate & Use'}
              </button>
              {genError && (
                <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">{genError}</p>
              )}
              <p className="text-xs text-gray-600">Generated image will be added to the library and auto-selected.</p>
            </div>
          )}
        </div>

        {/* Pagination — library tab only */}
        {tab === 'library' && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-5 py-2 border-t border-gray-800 shrink-0">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-xs text-white rounded-lg transition-colors"
            >← Prev</button>
            <span className="text-xs text-gray-500">{page} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-xs text-white rounded-lg transition-colors"
            >Next →</button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 shrink-0">
          <p className="text-xs text-gray-600">
            {selected ? '1 image selected' : 'Click an image to select it'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
            >Cancel</button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selected}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
            >Use this image</button>
          </div>
        </div>
      </div>
    </div>
  )
}
