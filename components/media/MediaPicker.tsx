'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { compressImage } from '@/lib/compress-image'
import { fetchAssetAsFile } from '@/lib/images/derive-crop'
import { CATEGORIES } from '@/lib/categories'
import ImageCropper from '@/components/ui/ImageCropper'

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
  /**
   * When set, the Library tab opens pre-filtered to images belonging to this
   * guide/review (media_assets.source_type/source_id — migration 114), with a
   * toggle to view the whole library. Lets you reuse a source's own hero/inline
   * images (e.g. when attaching one to an X post).
   */
  sourceType?: 'guide' | 'review'
  sourceId?: string
  /**
   * If set, single-file uploads route through ImageCropper before save with
   * this aspect ratio (width / height, e.g. 4/3 for 1.333). Multi-file
   * uploads skip the cropper. Pass undefined to upload-without-cropping.
   *
   * Common values:
   *   4/3   ← phone landscape, product photos, card grids
   *   16/10 ← detail-page hero (cinematic but accepts landscape phone shots)
   *   1     ← square (avatars, product gallery)
   *   3/4   ← portrait (rare; phone portrait without rotation)
   */
  uploadAspect?: number
}

type Tab = 'library' | 'generate'

export default function MediaPicker({ onSelect, onClose, defaultProductId, defaultCategory, multi, onMultiSelect, uploadAspect, sourceType, sourceId }: MediaPickerProps) {
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
  // Guards the one-time "seeded filter returned nothing → show All" fallback so
  // it never overrides a filter the user later picks by hand.
  const firstLoadRef = useRef(true)

  // Crop-on-upload state — populated when a single file is being processed
  // and uploadAspect was provided. The ref holds the Promise resolver so the
  // uploadFiles flow can await user interaction with the cropper.
  const [cropPending, setCropPending] = useState<File | null>(null)
  const cropResolveRef = useRef<((file: File | null) => void) | null>(null)
  // Apply-time crop: a selected library/AI asset fetched back as a File so the
  // user can reframe it. The result is uploaded as a NEW asset (derived copy).
  const [applyCropFile, setApplyCropFile] = useState<File | null>(null)

  function awaitCrop(file: File): Promise<File | null> {
    return new Promise((resolve) => {
      cropResolveRef.current = resolve
      setCropPending(file)
    })
  }

  function handleCropDone(blob: Blob) {
    const sourceName = cropPending?.name ?? 'image'
    const file = new File(
      [blob],
      sourceName.replace(/\.[^.]+$/, '.webp'),
      { type: 'image/webp', lastModified: Date.now() },
    )
    cropResolveRef.current?.(file)
    cropResolveRef.current = null
    setCropPending(null)
  }

  // "Use full image" — skip cropping, upload the original (compressed) file.
  function handleCropSkip() {
    cropResolveRef.current?.(cropPending)
    cropResolveRef.current = null
    setCropPending(null)
  }

  function handleCropCancel() {
    cropResolveRef.current?.(null)
    cropResolveRef.current = null
    setCropPending(null)
  }

  // Apply-time crop: load the selected asset as a File and open the cropper.
  async function handleCropSelected() {
    if (!selected) return
    setUploadError(null)
    try {
      const file = await fetchAssetAsFile(selected)
      setApplyCropFile(file)
    } catch {
      setUploadError('Could not load image for cropping — try again')
    }
  }

  // Cropped derived image → upload as a new asset, then apply it immediately.
  async function handleApplyCropDone(blob: Blob) {
    setApplyCropFile(null)
    setUploading(true); setUploadError(null)
    try {
      const file = new File([blob], 'crop.webp', { type: 'image/webp' })
      const fd = new FormData()
      fd.append('file', file)
      if (uploadCategory)  fd.append('category',   uploadCategory)
      if (uploadProductId) fd.append('product_id', uploadProductId)
      const res = await fetch('/api/media', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Crop save failed')
      const asset = json.asset as MediaAsset
      setAssets((prev) => [asset, ...prev])
      setTotal((t) => t + 1)
      onSelect(asset.url, asset.alt_text ?? '', asset.id)
    } catch (err) {
      setUploadError(`Crop failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Product + category filters — pre-seeded from caller context.
  // Both are orthogonal — they AND together server-side so an editor can drill
  // down "category=grilling AND product=traeger-xl" or keep either alone.
  const [products, setProducts] = useState<Product[]>([])
  const [filterProductId, setFilterProductId] = useState<string>(defaultProductId ?? '')
  // When the caller has a product to snap to (review/product pickers), open on
  // "All categories" and let the product filter do the narrowing. Only seed the
  // category filter when there's no product context (guides, hero, articles) so
  // those surfaces still open pre-filtered instead of dumping the whole library.
  // Either way `defaultCategory` still tags new uploads via `uploadCategory`.
  const [filterCategory,  setFilterCategory]  = useState<string>(defaultProductId ? '' : (defaultCategory ?? ''))

  // Tags applied to NEW uploads: the active drill-down filter when the user has
  // one, otherwise the caller's context (so an image uploaded from the "All"
  // view — e.g. after the empty-filter fallback — still inherits the article's
  // category/product). '__none__' is a negative filter, so it tags nothing.
  const uploadCategory  = filterCategory  === '__none__' ? '' : (filterCategory  || defaultCategory  || '')
  const uploadProductId = filterProductId === '__none__' ? '' : (filterProductId || defaultProductId || '')

  // Generate state
  const [genPrompt, setGenPrompt] = useState('')
  const [genSize, setGenSize] = useState<'1024x1024' | '1536x1024' | '1024x1536'>('1536x1024')
  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  // Safety-rule toggles. Brands are always blocked server-side; these relax the
  // two situational clauses. Default OFF = text + people allowed (SOCIAL_FLEXIBLE).
  const [genNoText, setGenNoText] = useState(false)
  const [genNoPeople, setGenNoPeople] = useState(false)

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

  // Default to the source's own images when a source context was passed.
  const [sourceOnly, setSourceOnly] = useState<boolean>(!!sourceId)

  const fetchAssets = useCallback(async (p: number, productId: string, category: string, bySource: boolean) => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(p) })
    if (productId) qs.set('product_id', productId)
    if (category)  qs.set('category',   category)
    if (bySource && sourceType && sourceId) {
      qs.set('source_type', sourceType)
      qs.set('source_id',   sourceId)
    }
    const res = await fetch(`/api/media?${qs}`)
    let nextTotal = 0
    if (res.ok) {
      const json = await res.json()
      setAssets(json.assets)
      setTotal(json.total)
      nextTotal = json.total
    }
    setLoading(false)

    // One-time only: if the caller pre-seeded a product/category/source filter and
    // it came back empty, drop to "All" so the editor sees the library immediately
    // instead of an empty grid they have to clear by hand. Never fires again, so
    // a filter the user deliberately picks later is respected.
    if (firstLoadRef.current) {
      firstLoadRef.current = false
      if (nextTotal === 0 && (productId || category || bySource)) {
        setFilterProductId('')
        setFilterCategory('')
        setSourceOnly(false)
      }
    }
  }, [sourceType, sourceId])

  useEffect(() => { fetchAssets(page, filterProductId, filterCategory, sourceOnly) }, [fetchAssets, page, filterProductId, filterCategory, sourceOnly])

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

    // Crop-on-upload: every single-file upload is routed through the cropper
    // after compression. With uploadAspect the ratio is locked; without it the
    // cropper offers a ratio selector + "Use full image" skip. Multi-file
    // uploads skip the cropper (would need a per-file queue UI) — drop them in
    // and crop later from the picker if needed.
    let prepared: File[]
    if (list.length === 1) {
      const compressed = await compressImage(list[0])
      const cropped = await awaitCrop(compressed)
      if (!cropped) {
        // User cancelled the cropper — abort upload, no error toast.
        setUploading(false)
        return
      }
      prepared = [cropped]
    } else {
      // Multi-file or no aspect requested — compress and upload as-is.
      prepared = await Promise.all(list.map((f) => compressImage(f)))
    }

    const results = await Promise.allSettled(
      prepared.map(async (file) => {
        const fd = new FormData()
        fd.append('file', file)
        // Tag new uploads with the active filter, or the caller's context when
        // viewing "All", so they're findable by the same filters next time.
        if (uploadCategory)  fd.append('category',   uploadCategory)
        if (uploadProductId) fd.append('product_id', uploadProductId)
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
        body: JSON.stringify({ prompt: genPrompt.trim(), size: genSize, no_text: genNoText, no_people: genNoPeople }),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/70" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Media picker"
        className="bg-surface-sunken border border-soft rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-soft shrink-0">
          <div className="flex items-center gap-1 bg-surface border border-soft rounded-xl p-1">
            <button
              type="button"
              onClick={() => setTab('library')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                tab === 'library' ? 'bg-surface-raised text-prose' : 'text-prose-faint hover:text-prose'
              }`}
            >
              Library
            </button>
            <button
              type="button"
              onClick={() => setTab('generate')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                tab === 'generate' ? 'bg-surface-raised text-prose' : 'text-prose-faint hover:text-prose'
              }`}
            >
              Generate
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap grow sm:grow-0 justify-end">
            {/* Source toggle — only when the caller passed a guide/review context. */}
            {tab === 'library' && sourceId && (
              <button
                type="button"
                onClick={() => { setSourceOnly((v) => !v); setPage(1); setSearchQuery('') }}
                title={`Show only images from this ${sourceType}`}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  sourceOnly ? 'bg-accent text-white border-accent' : 'bg-surface-raised text-prose-muted border-strong hover:text-prose'
                }`}
              >
                From this {sourceType}
              </button>
            )}
            {/* Search */}
            {tab === 'library' && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…"
                className="grow min-w-[7rem] sm:grow-0 sm:w-36 px-2 py-1.5 bg-surface-raised border border-strong text-xs text-prose-muted placeholder:text-prose-faint rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-hover"
              />
            )}
            {/* Category filter — editorial axis. Independent of the product
                filter; both AND together server-side. */}
            {tab === 'library' && (
              <select
                value={filterCategory}
                onChange={(e) => handleCategoryFilterChange(e.target.value)}
                title="Filter library by editorial category"
                className="px-2 py-1.5 bg-surface-raised border border-strong text-xs text-prose-muted rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-hover"
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
                className="px-2 py-1.5 bg-surface-raised border border-strong text-xs text-prose-muted rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-hover"
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-raised hover:bg-surface disabled:opacity-50 text-prose text-xs font-medium rounded-lg transition-colors"
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
            <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 text-prose-faint hover:text-prose transition-colors rounded-lg hover:bg-surface-raised">
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
          <p className="text-prose-faint text-xs border-b border-soft px-5 py-2 shrink-0">
            📐 For best results upload <span className="text-prose-muted font-medium">landscape images (16:9)</span> — recommended for hero slots on bench items, reviews, and guides.
          </p>
        )}
        {uploadError && tab === 'library' && (
          <p className="text-red-700 text-xs bg-red-50 border-b border-red-300 px-5 py-2.5 shrink-0">{uploadError}</p>
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
                className="border-2 border-dashed border-strong rounded-xl py-16 flex flex-col items-center gap-2 text-prose-faint cursor-pointer hover:border-strong transition-colors"
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
                          : 'border-transparent hover:border-strong'
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
                            {asset.is_primary && <span className="text-accent-text">★ </span>}
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
                <label className="block text-sm text-prose-muted mb-2">Prompt</label>
                <textarea
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                  rows={5}
                  placeholder="Describe the image — include subject, setting, lighting, style. Example: 'a DeWalt cordless drill on a wooden workbench, warm natural light, editorial photography, no people, no text'"
                  className="w-full px-4 py-3 bg-surface border border-strong rounded-xl text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-prose-muted mb-2">Aspect ratio</label>
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
                        genSize === opt.value ? 'bg-accent text-white' : 'bg-surface border border-soft text-prose-muted hover:border-strong'
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
              <div>
                <label className="block text-sm text-prose-muted mb-2">Restrictions</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm text-prose cursor-pointer">
                    <input
                      type="checkbox"
                      checked={genNoText}
                      onChange={(e) => setGenNoText(e.target.checked)}
                      className="w-4 h-4 accent-[var(--color-accent)]"
                    />
                    No text or watermarks
                  </label>
                  <label className="flex items-center gap-2 text-sm text-prose cursor-pointer">
                    <input
                      type="checkbox"
                      checked={genNoPeople}
                      onChange={(e) => setGenNoPeople(e.target.checked)}
                      className="w-4 h-4 accent-[var(--color-accent)]"
                    />
                    No people
                  </label>
                  <p className="text-xs text-prose-faint">Brand names, logos, and real-world products are always blocked.</p>
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
                <p className="text-red-700 text-sm bg-red-50 border border-red-300 rounded-lg px-4 py-3">{genError}</p>
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
              className="px-3 py-1.5 bg-surface-raised hover:bg-surface disabled:opacity-40 text-xs text-prose rounded-lg transition-colors"
            >← Prev</button>
            <span className="text-xs text-prose-faint">{page} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 bg-surface-raised hover:bg-surface disabled:opacity-40 text-xs text-prose rounded-lg transition-colors"
            >Next →</button>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-soft shrink-0">
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
              className="px-4 py-2 bg-surface-raised hover:bg-surface text-prose-muted text-sm rounded-lg transition-colors"
            >Cancel</button>
            {!multi && selected && (
              <button
                type="button"
                onClick={handleCropSelected}
                disabled={uploading}
                className="px-4 py-2 bg-surface-raised hover:bg-surface disabled:opacity-40 text-prose text-sm font-semibold rounded-lg transition-colors"
              >Crop</button>
            )}
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

      {/* Crop-on-upload overlay — fixed inset-0 z-50, above the picker dialog.
          Appears for every single-file upload once compression finishes. With
          uploadAspect the ratio is locked; without it the user gets a ratio
          selector + "Use full image" skip. */}
      {cropPending && (
        <ImageCropper
          file={cropPending}
          aspect={uploadAspect}
          allowRatioChange={!uploadAspect}
          onCrop={handleCropDone}
          onCancel={handleCropCancel}
          onSkip={uploadAspect ? undefined : handleCropSkip}
        />
      )}

      {/* Apply-time crop overlay — reframes an existing/AI asset into a new
          derived asset, then applies it. */}
      {applyCropFile && (
        <ImageCropper
          file={applyCropFile}
          aspect={uploadAspect}
          allowRatioChange={!uploadAspect}
          onCrop={handleApplyCropDone}
          onCancel={() => setApplyCropFile(null)}
        />
      )}
    </div>
  )
}
