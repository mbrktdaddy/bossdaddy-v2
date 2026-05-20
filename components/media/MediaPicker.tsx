'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { compressImage } from '@/lib/compress-image'
import { CATEGORIES } from '@/lib/categories'

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

export interface MultiSelectItem {
  url: string
  altText: string
  assetId?: string
}

interface MediaPickerProps {
  onSelect: (url: string, altText: string, assetId?: string) => void
  onClose: () => void
  defaultProductId?: string
  /**
   * Editorial category slug from the calling context (article, product, etc.).
   * Pre-seeds the library filter AND is sent on uploads from the picker so
   * new assets are tagged with the article's category for future reuse.
   * Source of truth: `lib/categories.ts`. Pass the category SLUG, not the label.
   */
  defaultCategory?: string
  /** Enable multi-select mode — confirm fires onMultiSelect instead of onSelect */
  multi?: boolean
  onMultiSelect?: (items: MultiSelectItem[]) => void
}

type Tab = 'library' | 'generate'

export default function MediaPicker({ onSelect, onClose, defaultProductId, defaultCategory, multi, onMultiSelect }: MediaPickerProps) {
  const [tab, setTab] = useState<Tab>('library')

  // Library state
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)          // single mode
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set()) // multi mode
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Product + category filters — pre-seeded from caller context.
  // Both are orthogonal — they AND together server-side so an editor can drill
  // down "category=grilling AND product=traeger-xl" or keep either alone.
  const [products, setProducts] = useState<Product[]>([])
  const [filterProductId, setFilterProductId] = useState<string>(defaultProductId ?? '')
  const [filterCategory,  setFilterCategory]  = useState<string>(defaultCategory  ?? '')

  // Generate state
  const [genPrompt, setGenPrompt] = useState('')
  const [genSize, setGenSize] = useState<'1024x1024' | '1536x1024' | '1024x1536'>('1536x1024')
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

  const fetchAssets = useCallback(async (p: number, productId: string, category: string) => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(p) })
    if (productId) qs.set('product_id', productId)
    if (category)  qs.set('category',   category)
    const res = await fetch(`/api/media?${qs}`)
    if (res.ok) {
      const json = await res.json()
      setAssets(json.assets)
      setTotal(json.total)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAssets(page, filterProductId, filterCategory) }, [fetchAssets, page, filterProductId, filterCategory])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Reset to page 1 when either filter changes — keeps the user from being
  // stranded on page 5 of "no results" after narrowing the filter set.
  function handleProductFilterChange(productId: string) {
    setFilterProductId(productId)
    setPage(1)
    setSelected(null)
    setSearchQuery('')
  }
  function handleCategoryFilterChange(category: string) {
    setFilterCategory(category)
    setPage(1)
    setSelected(null)
    setSearchQuery('')
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (!list.length) return
    setUploading(true); setUploadError(null)

    const results = await Promise.allSettled(
      list.map(async (raw) => {
        const file = await compressImage(raw)
        const fd = new FormData()
        fd.append('file', file)
        // Tag new uploads with the active filter context so they're findable
        // by the same filters next time. Skips __none__ since that's a
        // negative filter, not a value.
        if (filterCategory  && filterCategory  !== '__none__') fd.append('category',   filterCategory)
        if (filterProductId && filterProductId !== '__none__') fd.append('product_id', filterProductId)
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
    if (multi) {
      if (multiSelected.size === 0) return
      const items: MultiSelectItem[] = Array.from(multiSelected).map((url) => {
        const asset = assets.find((a) => a.url === url)
        return { url, altText: asset?.alt_text ?? '', assetId: asset?.id }
      })
      onMultiSelect?.(items)
    } else {
      if (!selected) return
      const asset = assets.find((a) => a.url === selected)
      onSelect(selected, asset?.alt_text ?? '', asset?.id)
    }
  }

  function toggleMultiSelect(url: string) {
    setMultiSelected((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url); else next.add(url)
      return next
    })
  }

  const totalPages = Math.ceil(total / LIMIT)

  // Map product_id → name for badge display
  const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="bg-surface-sunken border border-soft rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-soft shrink-0">
          <div className="flex items-center gap-1 bg-surface border border-soft rounded-xl p-1">
            <button
              type="button"
              onClick={() => setTab('library')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                tab === 'library' ? 'bg-surface-raised text-white' : 'text-prose-faint hover:text-gray-300'
              }`}
            >
              Library
            </button>
            <button
              type="button"
              onClick={() => setTab('generate')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                tab === 'generate' ? 'bg-surface-raised text-white' : 'text-prose-faint hover:text-gray-300'
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
                className="w-28 sm:w-36 px-2 py-1.5 bg-surface-raised border border-strong text-xs text-gray-300 placeholder-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-hover"
              />
            )}
            {/* Category filter — editorial axis. Independent of the product
                filter; both AND together server-side. */}
            {tab === 'library' && (
              <select
                value={filterCategory}
                onChange={(e) => handleCategoryFilterChange(e.target.value)}
                title="Filter library by editorial category"
                className="px-2 py-1.5 bg-surface-raised border border-strong text-xs text-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-hover"
              >
                <option value="">All categories</option>
                <option value="__none__">Uncategorized only</option>
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.shortLabel}</option>
                ))}
              </select>
            )}
            {/* Product filter — physical-asset axis (specific product). */}
            {tab === 'library' && products.length > 0 && (
              <select
                value={filterProductId}
                onChange={(e) => handleProductFilterChange(e.target.value)}
                title="Filter library by attached product"
                className="px-2 py-1.5 bg-surface-raised border border-strong text-xs text-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-hover"
              >
                <option value="">All products</option>
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-raised hover:bg-gray-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
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
            <button type="button" onClick={onClose} className="p-1.5 text-prose-faint hover:text-white transition-colors rounded-lg hover:bg-surface-raised">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
        </div>

        {tab === 'library' && !uploadError && (
          <p className="text-prose-faint text-xs border-b border-soft/60 px-5 py-2 shrink-0">
            📐 For best results upload <span className="text-prose-muted font-medium">landscape images (16:9)</span> — recommended for hero slots on bench items, reviews, and guides.
          </p>
        )}
        {uploadError && tab === 'library' && (
          <p className="text-red-400 text-xs bg-red-950/50 border-b border-red-900/40 px-5 py-2.5 shrink-0">{uploadError}</p>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'library' ? (
            loading ? (
              <div className="flex items-center justify-center gap-2 text-prose-faint py-16">
                <div className="w-4 h-4 border-2 border-strong border-t-orange-500 rounded-full animate-spin" />
                Loading…
              </div>
            ) : filteredAssets.length === 0 ? (
              <div
                className="border-2 border-dashed border-strong rounded-xl py-16 flex flex-col items-center gap-2 text-prose-faint cursor-pointer hover:border-gray-600 transition-colors"
                onClick={() => !searchQuery && setTab('generate')}
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">
                  {searchQuery
                    ? `No images match "${searchQuery}"`
                    : filterProductId
                      ? 'No images for this product yet'
                      : filterCategory
                        ? 'No images in this category yet'
                        : 'No images yet — click to generate one'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {filteredAssets.map((asset) => {
                  const productName  = asset.product_id ? productMap[asset.product_id] : null
                  const isSelected   = multi ? multiSelected.has(asset.url) : selected === asset.url
                  const selectionIdx = multi ? Array.from(multiSelected).indexOf(asset.url) : -1
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() =>
                        multi
                          ? toggleMultiSelect(asset.url)
                          : setSelected(asset.url === selected ? null : asset.url)
                      }
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                        isSelected
                          ? 'border-accent ring-2 ring-accent-hover/30'
                          : 'border-transparent hover:border-gray-600'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.url} alt={asset.alt_text ?? asset.filename} className="w-full h-full object-cover" loading="lazy" />

                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-accent-hover rounded-full flex items-center justify-center shadow">
                          {multi && selectionIdx >= 0 ? (
                            <span className="text-[9px] text-white font-bold leading-none">{selectionIdx + 1}</span>
                          ) : (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      )}

                      {/* Product badge */}
                      {productName && (
                        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-surface-sunken/80">
                          <p className="text-[9px] text-accent-text-soft font-semibold truncate leading-tight">
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
                  className="w-full px-4 py-3 bg-surface border border-strong rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Aspect ratio</label>
                <div className="flex gap-2">
                  {[
                    { value: '1536x1024', label: 'Landscape', ratio: '3:2', recommended: true },
                    { value: '1024x1024', label: 'Square',    ratio: '1:1', recommended: false },
                    { value: '1024x1536', label: 'Portrait',  ratio: '2:3', recommended: false },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setGenSize(opt.value as typeof genSize)}
                      className={`relative flex-1 flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors ${
                        genSize === opt.value ? 'bg-accent text-white' : 'bg-surface border border-soft text-prose-muted hover:border-gray-600'
                      }`}
                    >
                      {opt.recommended && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-accent-hover text-white text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full leading-none">
                          Best
                        </span>
                      )}
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
                className="w-full px-5 py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
              >
                {genLoading ? 'Generating…' : 'Generate & Use'}
              </button>
              {genError && (
                <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">{genError}</p>
              )}
              <p className="text-xs text-prose-faint">Generated image will be added to the library and auto-selected.</p>
            </div>
          )}
        </div>

        {/* Pagination — library tab only */}
        {tab === 'library' && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-5 py-2 border-t border-soft shrink-0">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-surface-raised hover:bg-gray-700 disabled:opacity-40 text-xs text-white rounded-lg transition-colors"
            >← Prev</button>
            <span className="text-xs text-prose-faint">{page} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 bg-surface-raised hover:bg-gray-700 disabled:opacity-40 text-xs text-white rounded-lg transition-colors"
            >Next →</button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-soft shrink-0">
          <p className="text-xs text-prose-faint">
            {multi
              ? multiSelected.size > 0
                ? `${multiSelected.size} image${multiSelected.size === 1 ? '' : 's'} selected`
                : 'Click images to select them'
              : selected
                ? '1 image selected'
                : 'Click an image to select it'
            }
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-raised hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
            >Cancel</button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={multi ? multiSelected.size === 0 : !selected}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {multi
                ? multiSelected.size > 1
                  ? `Use these ${multiSelected.size} images`
                  : multiSelected.size === 1
                    ? 'Use this image'
                    : 'Use these images'
                : 'Use this image'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
