'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { Product, ProductSpec } from '@/lib/products'
import { STORE_OPTIONS, PRODUCT_STATUS_OPTIONS, RADAR_TAKE_MAX, ACQUISITION_OPTIONS, acquisitionDisclosure, type ProductAcquisition } from '@/lib/products'
import { LABELS } from '@/lib/labels'
import { CATEGORIES, getCategoryLabel } from '@/lib/categories'
import { getSpecTemplate } from '@/lib/spec-templates'
import { MODEL_NUMBER_MAX, normalizeGtin, productSlugSource, splitIdentifierSpecs } from '@/lib/products/identifiers'
import { slugifyTitle } from '@/lib/slug'
import { imageHost, isRenderableImageUrl } from '@/lib/images/remote-hosts'
import { isLikelyGraphic } from '@/lib/images/candidates'
import type { LookupSource, ProductLookup } from '@/lib/products/import'
import { ProductImageGallery } from '@/components/admin/ProductImageGallery'
import { PendingImageGallery, flushPendingImages, type PendingImage } from '@/components/admin/PendingImageGallery'
import { buildAmazonAffiliateUrl, extractAsin, isValidAsin } from '@/lib/amazon-tag'
import { TagPicker } from '@/components/workspace/TagPicker'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { buttonVariants } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface Props {
  product: Product | null
  initialTags?: string[]
  amazonAssociateTag: string
}

// Mirror of the `z.array().max(30)` cap in the product create/update API.
const MAX_SPECS = 30

// ISO timestamp → the `YYYY-MM-DDTHH:mm` a datetime-local input wants, in the
// browser's local time (toISOString would render it in UTC).
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// One page-image candidate, downloaded through the guarded fetcher for the picker.
interface PickerItem { url: string; blob: Blob; previewUrl: string; w: number; h: number }

const PICKER_CONCURRENCY = 3

// Shortest edge uploads accept: mirrors MIN_DIMENSION in lib/images/normalize.ts
// (server-only, not exported). Smaller previews would be rejected on add.
const MIN_IMAGE_EDGE = 400

// Poll a background web-lookup job every 2.5s for up to ~3.5 min. A failed poll
// is a hiccup, not a failure: keep polling until the deadline. Module-level (not
// inside the component) so the wall-clock reads are plainly outside render.
async function pollLookupJob(
  jobId: string,
  onProgress: (elapsedSeconds: number) => void,
): Promise<{ lookup: ProductLookup; slug: string | null }> {
  const startedAt = Date.now()
  for (let i = 0; i < 84; i++) {
    await new Promise((r) => setTimeout(r, 2500))
    onProgress(Math.round((Date.now() - startedAt) / 1000))
    const poll = await fetch(`/api/admin/products/import?jobId=${encodeURIComponent(jobId)}`)
    if (poll.status === 404) throw new Error('The lookup went missing. Run it again.')
    const job = await poll.json().catch(() => null)
    if (!poll.ok || !job) continue
    if (job.status === 'error') throw new Error(job.error ?? 'The lookup failed. Run it again.')
    if (job.status === 'done') return job.result
  }
  throw new Error('The lookup is taking unusually long. Run it again in a moment.')
}

// Download one candidate and read its pixel size. A failed download resolves
// to null and an undersized image to 'small'; neither appears in the picker.
async function loadPickerItem(url: string, pageUrl: string | undefined): Promise<PickerItem | 'small' | null> {
  let previewUrl = ''
  try {
    const res = await fetch('/api/admin/products/import-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url], ...(pageUrl ? { pageUrl } : {}) }),
    })
    if (!res.ok) return null
    const blob = await res.blob()
    previewUrl = URL.createObjectURL(blob)
    const src = previewUrl
    const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => reject(new Error('decode'))
      img.src = src
    })
    if (Math.min(size.w, size.h) < MIN_IMAGE_EDGE) {
      URL.revokeObjectURL(previewUrl)
      return 'small'
    }
    return { url, blob, previewUrl, ...size }
  } catch {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    return null
  }
}

export function ProductForm({ product, initialTags = [], amazonAssociateTag }: Props) {
  const router = useRouter()
  const isNew = !product

  const [slug, setSlug]                         = useState(product?.slug ?? '')
  const [name, setName]                         = useState(product?.name ?? '')
  const [brand, setBrand]                       = useState(product?.brand ?? '')
  // Identifiers (mig 159). The API answers a model already in the catalog with
  // a 409; dupWarning holds it until the admin saves anyway or changes it.
  const [modelNumber, setModelNumber]           = useState(product?.model_number ?? '')
  const [gtin, setGtin]                         = useState(product?.gtin ?? '')
  const [dupWarning, setDupWarning]             = useState<string | null>(null)
  const [specs, setSpecs]                       = useState<ProductSpec[]>(product?.specs ?? [])
  const [asin, setAsin]                         = useState(product?.asin ?? '')
  const [store, setStore]                       = useState<string>(product?.store ?? 'amazon')
  const [customStoreName, setCustomStoreName]   = useState(product?.custom_store_name ?? '')
  const [affiliateUrl, setAffiliateUrl]         = useState(product?.affiliate_url ?? '')
  const [nonAffiliateUrl, setNonAffUrl]         = useState(product?.non_affiliate_url ?? '')
  const [imageUrl, setImageUrl]                 = useState(product?.image_url ?? '')

  const [description, setDescription] = useState(product?.description ?? '')
  const [category, setCategory]       = useState(product?.category ?? '')
  const [tags, setTags]               = useState<string[]>(initialTags)
  const [priceCents, setPriceCents]   = useState(product?.price_cents != null ? String(product.price_cents) : '')
  const [status, setStatus]           = useState<string>(product?.status ?? 'catalog')

  // Bench pipeline fields (folded in from the former wishlist admin).
  const [priority, setPriority]           = useState(String(product?.priority ?? 0))
  const [estimatedDate, setEstimatedDate] = useState(product?.estimated_review_date ?? '')
  const [skipReason, setSkipReason]       = useState(product?.skip_reason ?? '')

  // How I got it (mig 158). Blank = no claim. provided/loaner render the legal
  // disclosure wherever the product is reviewed or recommended.
  const [acquisition, setAcquisition] = useState<ProductAcquisition | ''>(product?.acquisition ?? '')
  const [providedBy, setProvidedBy]   = useState(product?.provided_by ?? '')
  const isConnection = acquisition === 'provided' || acquisition === 'loaner'

  // On the Radar (mig 157). The take is kept after the product moves on (the
  // archive shows it), so it's never nulled by a status change. spotted_at is
  // the release time: the DB trigger stamps it on entry into Radar, so the
  // field is only prefilled while the product is on Radar and only sent when
  // edited (a stale date from an earlier Radar stint must not be resent).
  const initialGoLive                   = product?.status === 'radar' && product.spotted_at ? toLocalInput(product.spotted_at) : ''
  const [radarTake, setRadarTake]       = useState(product?.radar_take ?? '')
  const [goLive, setGoLive]             = useState(initialGoLive)
  const wasOnRadar                      = !!product?.spotted_at
  // The server can't know the browser's zone, so the go-live time renders only
  // after hydration (same pattern as the savings GoalForm). The SSR pass would
  // otherwise bake in a UTC wall time the client never corrects.
  const inBrowser = useSyncExternalStore(() => () => {}, () => true, () => false)

  const [busy, setBusy]                   = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [deleting, setDeleting]           = useState(false)
  const [importing, setImporting]         = useState(false)
  const [importResult, setImportResult]   = useState<string | null>(null)

  // New-product mode: stage images client-side until the product row exists
  // (media_assets.product_id is a UUID FK, can't write rows for a product
  // that hasn't been created yet). Flushed via flushPendingImages on save.
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  // After a successful product POST, if some uploads failed, we stop the
  // navigation flow and let the user choose when to continue to the edit
  // page. createdProductId carries that signal forward.
  const [createdProductId, setCreatedProductId] = useState<string | null>(null)
  const [uploadStatus,     setUploadStatus]     = useState<string | null>(null)

  // Paste-a-link import (step 2b, lib/products/import.ts). Fills EMPTY fields
  // only; the retailer's own copy is kept as reference, never auto-published.
  const [linkUrl,       setLinkUrl]       = useState('')
  const [linkBusy,      setLinkBusy]      = useState<'page' | 'lookup' | null>(null)
  const [linkNote,      setLinkNote]      = useState<string | null>(null)
  const [retailerRef,   setRetailerRef]   = useState<string | null>(null)
  // The page the import actually read (short links resolved). The web lookup
  // uses it, so an a.co link still reaches the lookup with its ASIN.
  const [linkSource,    setLinkSource]    = useState<string | null>(null)
  // The page's own product images, when the lead one is on a host the site
  // can't render. Offered, not attached: "Choose images" opens a picker, and
  // "Add selected" uploads the ticked ones like any other photo.
  const [pageImages,    setPageImages]    = useState<string[]>([])
  // The page those candidates came from: Referer for the downloads and the
  // provenance URL of whatever gets added (a lookup source, not always linkUrl).
  const [pageImagesFrom, setPageImagesFrom] = useState<string | null>(null)
  // Which source's "Get images" is running (its URL), if any.
  const [sourceBusy,    setSourceBusy]    = useState<string | null>(null)
  // Candidates dropped from the picker: download failed / under the minimum edge.
  const [pickerSkipped, setPickerSkipped] = useState({ failed: 0, small: 0 })
  // Picker previews (null = closed). The blobs are kept so adding a tick never
  // downloads twice; the object URLs are revoked on close/unmount.
  const [picker,        setPicker]        = useState<PickerItem[] | null>(null)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerAdding,  setPickerAdding]  = useState(false)
  const [picked,        setPicked]        = useState<Set<string>>(new Set())
  const pickerUrls = useRef<string[]>([])
  const pickerRun  = useRef(0)
  // Where the web lookup's facts came from, so they can be checked before saving.
  const [lookupSources, setLookupSources] = useState<LookupSource[]>([])
  // Bumped to remount ProductImageGallery (it loads on mount) after an add.
  const [galleryKey,    setGalleryKey]    = useState(0)

  // AI autofill (paste a spec sheet → structured brand + specs)
  const [factsText,    setFactsText]    = useState('')
  const [autofilling,  setAutofilling]  = useState(false)
  const [autofillNote, setAutofillNote] = useState<string | null>(null)

  const atSpecCap = specs.length >= MAX_SPECS

  function closePicker() {
    pickerRun.current++
    pickerUrls.current.forEach((u) => URL.revokeObjectURL(u))
    pickerUrls.current = []
    setPicker(null)
    setPickerSkipped({ failed: 0, small: 0 })
    setPickerLoading(false)
    setPicked(new Set())
  }

  useEffect(() => {
    const urls = pickerUrls
    const run = pickerRun
    return () => {
      run.current++
      urls.current.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  // What the web lookup will search with. Brand alone isn't enough to find a
  // product; a link, model number, GTIN or name is (mirrors hasLookupInput).
  const lookupUses = [
    modelNumber.trim() && 'model number',
    gtin.trim() && 'GTIN',
    brand.trim() && 'brand',
    name.trim() && 'name',
    linkUrl.trim() && 'link',
  ].filter((x): x is string => !!x)
  const skippedNote = [
    pickerSkipped.failed > 0 && `${pickerSkipped.failed} couldn't be downloaded`,
    pickerSkipped.small > 0 && `${pickerSkipped.small} too small (under ${MIN_IMAGE_EDGE}px)`,
  ].filter((x): x is string => !!x).join(' · ')
  const canLookup =!!(linkUrl.trim() || modelNumber.trim() || gtin.trim() || name.trim())

  // Shown under both image-URL overrides: next/image throws on any other host.
  const unrenderableImage = imageUrl.trim() && !isRenderableImageUrl(imageUrl.trim()) ? (
    <p className="text-warn-ink">
      The site can&apos;t show images hosted on {imageHost(imageUrl.trim()) ?? 'that site'}. Upload it to the gallery instead.
    </p>
  ) : null

  // The brand + model slug (dewalt-dcd801b), offered while the product is new.
  // Not checked for collisions here: the save answers a taken slug with a 409.
  const suggestedSlug = brand.trim() && modelNumber.trim()
    ? slugifyTitle(productSlugSource({ name, brand, modelNumber }))
    : ''

  function addSpec() {
    setSpecs((prev) => (prev.length >= MAX_SPECS ? prev : [...prev, { label: '', value: '' }]))
  }
  function updateSpec(i: number, field: keyof ProductSpec, val: string) {
    setSpecs((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)))
  }
  function removeSpec(i: number) {
    setSpecs((prev) => prev.filter((_, idx) => idx !== i))
  }

  // Snap a label to the category template's canonical casing when it matches
  // case-insensitively, so the same fact reads identically across products and
  // comparison-table rows line up. Non-template labels pass through trimmed.
  function canonicalLabel(label: string): string {
    const trimmed = label.trim()
    const t = getSpecTemplate(category).find((f) => f.label.toLowerCase() === trimmed.toLowerCase())
    return t ? t.label : trimmed
  }

  // Placeholder hint for a spec value input, drawn from the category template.
  function hintFor(label: string): string {
    const t = getSpecTemplate(category).find((f) => f.label.toLowerCase() === label.trim().toLowerCase())
    return t?.hint ? `Value — ${t.hint}` : 'Value'
  }

  // Seed the panel with the category's canonical spec labels (empty values),
  // skipping any label already present. Keeps comparison rows aligned. Respects
  // the MAX_SPECS cap.
  function applyTemplate() {
    const room = MAX_SPECS - specs.length
    if (room <= 0) return
    const have = new Set(specs.map((s) => s.label.trim().toLowerCase()))
    const additions = getSpecTemplate(category)
      .filter((f) => !have.has(f.label.toLowerCase()))
      .slice(0, room)
      .map((f) => ({ label: f.label, value: '' }))
    if (additions.length === 0) return
    setSpecs((prev) => [...prev, ...additions])
  }

  // Merge incoming specs: fill empty existing values, append new labels (snapped
  // to canonical casing), never clobber a typed value, respect the cap.
  // Computed synchronously so the reported counts are accurate. A "Model" or
  // "UPC" row is an identifier, not a spec: it fills its own field (if empty).
  function mergeSpecs(incoming: ProductSpec[]): { added: number; filled: number; capped: number; ids: string[] } {
    const split = splitIdentifierSpecs(incoming)
    const ids: string[] = []
    if (split.modelNumber && !modelNumber.trim()) { setModelNumber(split.modelNumber); ids.push('model number') }
    if (split.gtin && !gtin.trim()) { setGtin(split.gtin); ids.push('GTIN') }

    const byKey = new Map(specs.map((s) => [s.label.trim().toLowerCase(), { ...s }]))
    let added = 0, filled = 0, capped = 0
    for (const s of split.specs) {
      const key = s.label?.trim().toLowerCase()
      if (!key || !s.value?.trim()) continue
      const existing = byKey.get(key)
      if (existing) {
        if (!existing.value.trim()) { existing.value = s.value.trim(); filled++ }
      } else if (byKey.size < MAX_SPECS) {
        byKey.set(key, { label: canonicalLabel(s.label), value: s.value.trim() }); added++
      } else {
        capped++
      }
    }
    setSpecs(Array.from(byKey.values()))
    return { added, filled, capped, ids }
  }

  // The web lookup runs as a background job (the route answers with a jobId);
  // pollLookupJob (module level) waits for it.
  async function runLookupJob(): Promise<{ lookup: ProductLookup; slug: string | null }> {
    const url = linkSource ?? (linkUrl.trim() || undefined)
    const res = await fetch('/api/admin/products/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'lookup',
        ...(url ? { url } : {}),
        hints: {
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(brand.trim() ? { brand: brand.trim() } : {}),
          ...(modelNumber.trim() ? { modelNumber: modelNumber.trim() } : {}),
          ...(gtin.trim() ? { gtin: gtin.trim() } : {}),
        },
      }),
    })
    const start = await res.json().catch(() => null)
    if (!res.ok || !start?.jobId) throw new Error(start?.error ?? `Couldn't start the lookup (${res.status}).`)

    return pollLookupJob(start.jobId, (s) =>
      setLinkNote(`Searching the web… ${s}s (usually under a minute)`),
    )
  }

  async function handleLinkImport(mode: 'page' | 'lookup') {
    if (mode === 'page' && !linkUrl.trim()) return
    setLinkBusy(mode)
    setLinkNote(mode === 'lookup' ? 'Searching the web…' : null)
    try {
      let json
      if (mode === 'lookup') {
        json = await runLookupJob()
      } else {
        const res = await fetch('/api/admin/products/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: linkUrl.trim(), mode }),
        })
        json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Import failed')
      }

      // Only empty fields are filled: an import never overwrites what you typed.
      const filled: string[] = []
      const fill = (label: string, current: string, next: string | null | undefined, set: (v: string) => void) => {
        if (next && !current.trim()) { set(next); filled.push(label) }
      }

      if (mode === 'page') {
        const r = json.import
        fill('name', name, r.name, setName)
        fill('slug', slug, json.slug, setSlug)
        fill('brand', brand, r.brand, setBrand)
        fill('model number', modelNumber, r.modelNumber, setModelNumber)
        fill('GTIN', gtin, r.gtin, setGtin)
        // Only a host the site can render is used as-is; a store's image has
        // to be uploaded first, and only if the admin chooses it.
        if (r.imageUrl && isRenderableImageUrl(r.imageUrl)) fill('image', imageUrl, r.imageUrl, setImageUrl)
        else {
          closePicker()
          setPageImages((r.imageCandidates ?? []).filter(Boolean))
          setPageImagesFrom(r.sourceUrl ?? linkUrl.trim())
        }
        fill('price', priceCents, r.priceCents != null ? String(r.priceCents) : null, setPriceCents)
        // The link group is set together, and only when no link exists yet.
        if (!affiliateUrl.trim() && !nonAffiliateUrl.trim() && (r.affiliateUrl || r.nonAffiliateUrl)) {
          setStore(r.store)
          setCustomStoreName(r.customStoreName ?? '')
          if (r.asin) setAsin(r.asin)
          if (r.affiliateUrl) setAffiliateUrl(r.affiliateUrl)
          if (r.nonAffiliateUrl) setNonAffUrl(r.nonAffiliateUrl)
          filled.push(r.affiliateUrl ? 'affiliate link' : 'link')
        }
        const merged = r.specs?.length ? mergeSpecs(r.specs) : null
        if (merged) filled.push(...merged.ids)
        if (merged && merged.added + merged.filled > 0) filled.push(`${merged.added + merged.filled} specs`)
        if (r.retailerDescription) setRetailerRef(r.retailerDescription)
        setLinkSource(r.sourceUrl ?? null)
        setLookupSources([])
        const notes = (r.notes as string[]).join(' ')
        setLinkNote(`${filled.length ? `Filled: ${[...new Set(filled)].join(', ')}.` : 'Nothing new to fill.'}${notes ? ` ${notes}` : ''}`)
      } else {
        const l = json.lookup
        if (!l.found) {
          setLinkNote("The web lookup couldn't confirm that exact product.")
          return
        }
        fill('name', name, l.name, setName)
        fill('slug', slug, json.slug, setSlug)
        fill('brand', brand, l.brand, setBrand)
        fill('model number', modelNumber, l.modelNumber, setModelNumber)
        fill('GTIN', gtin, l.gtin, setGtin)
        fill('price', priceCents, l.priceCents != null ? String(l.priceCents) : null, setPriceCents)
        const merged = l.specs?.length ? mergeSpecs(l.specs) : null
        if (merged) filled.push(...merged.ids)
        if (merged && merged.added + merged.filled > 0) filled.push(`${merged.added + merged.filled} specs`)
        if (l.summary && !retailerRef) setRetailerRef(l.summary)
        const sources: LookupSource[] = Array.isArray(l.sources) ? l.sources : []
        setLookupSources(sources)
        setLinkNote(`${filled.length ? `Filled from the web: ${[...new Set(filled)].join(', ')}.` : 'Nothing new to fill.'} ${sources.length ? 'Check the facts against the sources below before saving.' : 'No sources came back, so check the facts yourself before saving.'}`)
      }
    } catch (err) {
      setLinkNote(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLinkBusy(null)
    }
  }

  // Download every candidate through our guarded fetcher (a few at a time) so
  // the admin can see what they're picking. Failed candidates are dropped.
  async function handleChooseImages(candidates: string[] = pageImages, from: string | null = pageImagesFrom) {
    if (candidates.length === 0) return
    const run = ++pickerRun.current
    const pageUrl = from || undefined
    setPicker([]); setPicked(new Set()); setPickerLoading(true)
    setPickerSkipped({ failed: 0, small: 0 })
    const results: (PickerItem | 'small' | null)[] = new Array(candidates.length).fill(null)
    let next = 0
    const worker = async () => {
      while (next < candidates.length) {
        const i = next++
        results[i] = await loadPickerItem(candidates[i], pageUrl)
      }
    }
    await Promise.all(Array.from({ length: Math.min(PICKER_CONCURRENCY, candidates.length) }, worker))
    const loaded = results.filter((r): r is PickerItem => typeof r === 'object' && r !== null)
    if (run !== pickerRun.current) { loaded.forEach((l) => URL.revokeObjectURL(l.previewUrl)); return }
    pickerUrls.current = loaded.map((l) => l.previewUrl)
    setPickerSkipped({
      failed: results.filter((r) => r === null).length,
      small: results.filter((r) => r === 'small').length,
    })
    setPicker(loaded)
    setPickerLoading(false)
  }

  // "Get images" on a lookup source: read that page's images only. Nothing else
  // from the response fills the form.
  async function handleSourceImages(source: LookupSource) {
    if (sourceBusy) return
    setSourceBusy(source.url)
    setLinkNote(null)
    try {
      const res = await fetch('/api/admin/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: source.url, mode: 'page' }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? 'Import failed')
      const candidates: string[] = ((json?.import?.imageCandidates ?? []) as string[]).filter(Boolean)
      if (candidates.length > 0) {
        const from: string = json.import.sourceUrl ?? source.url
        closePicker()
        setPageImages(candidates)
        setPageImagesFrom(from)
        void handleChooseImages(candidates, from)
      } else {
        let host = source.url
        try { host = new URL(source.url).hostname } catch { /* keep the raw url */ }
        const note = (json?.import?.notes as string[] | undefined)?.[0]
        setLinkNote(`No usable images on ${host}.${note ? ` ${note}` : ''}`)
      }
    } catch (err) {
      setLinkNote(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setSourceBusy(null)
    }
  }

  function togglePicked(url: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url); else next.add(url)
      return next
    })
  }

  // Stage the ticked previews as ordinary uploads: compressed, EXIF stripped,
  // stored in our bucket. Reuses the downloaded blobs.
  async function handleAddSelected() {
    const chosen = (picker ?? []).filter((p) => picked.has(p.url))
    if (chosen.length === 0) return
    setPickerAdding(true)
    try {
      const files = chosen.map((c) => new File([c.blob], `imported.${c.blob.type.split('/')[1] ?? 'jpg'}`, { type: c.blob.type }))
      // Provenance: these images came from a web page, not the camera or disk.
      const sourcePage = pageImagesFrom || undefined
      const provenance = { origin: 'web' as const, ...(sourcePage ? { originUrl: sourcePage } : {}) }
      if (isNew) {
        const staged: PendingImage[] = files.map((file) => ({
          kind: 'upload', file, previewUrl: URL.createObjectURL(file), isPrimary: false, ...provenance,
        }))
        setPendingImages((prev) => {
          const claim = !prev.some((p) => p.isPrimary)
          return [...prev, ...staged.map((s, i) => (claim && i === 0 ? { ...s, isPrimary: true } : s))]
        })
      } else {
        const result = await flushPendingImages(
          files.map((file, i): PendingImage => ({ kind: 'upload', file, previewUrl: '', isPrimary: i === 0 && !imageUrl.trim(), ...provenance })),
          product!.id,
          category || null,
        )
        if (result.failed) throw new Error(result.firstError ?? 'Upload failed.')
        setGalleryKey((k) => k + 1)
      }
      closePicker()
      setPageImages([])
      setPageImagesFrom(null)
      setLinkNote(`Added ${files.length} ${files.length === 1 ? 'image' : 'images'} to the gallery below.`)
    } catch (err) {
      setLinkNote(err instanceof Error ? err.message : "Couldn't add those images.")
    } finally {
      setPickerAdding(false)
    }
  }

  async function handleAutofill() {
    if (!factsText.trim()) { setAutofillNote('Paste some product copy first.'); return }
    setAutofilling(true); setAutofillNote(null)
    try {
      const res = await fetch('/api/claude/product-facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: factsText.trim(), ...(category ? { category } : {}) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Autofill failed')

      const incoming: ProductSpec[] = Array.isArray(json.specs) ? json.specs : []
      const { added, filled, capped, ids } = mergeSpecs(incoming)

      let brandNote = ''
      if (json.brand && !brand.trim()) { setBrand(json.brand); brandNote = ` Brand set to "${json.brand}".` }
      const idsNote = ids.length ? ` Set the ${ids.join(' and ')}.` : ''
      const cappedNote = capped ? ` ${capped} skipped (${MAX_SPECS}-spec limit).` : ''
      setAutofillNote(
        added + filled === 0 && !brandNote && !idsNote
          ? `No new facts found in that text.${cappedNote}`
          : `Added ${added}, filled ${filled}.${brandNote}${idsNote}${cappedNote} Review before saving.`,
      )
    } catch (err) {
      setAutofillNote(err instanceof Error ? err.message : 'Autofill failed')
    } finally {
      setAutofilling(false)
    }
  }

  // `allowDuplicateModel` is the "Save anyway" answer to the duplicate-model 409.
  async function handleSave(e: React.SyntheticEvent, { allowDuplicateModel = false } = {}) {
    e.preventDefault()

    // Special branch: product was already created in a prior submit attempt
    // but some uploads failed — the form is now a "continue to edit page"
    // shim. Clicking save here just navigates.
    if (createdProductId) {
      router.push(`/dashboard/admin/products/${createdProductId}`)
      return
    }

    if (status === 'passed' && !skipReason.trim()) {
      setError('Skip reason is required when status is "Passed".')
      return
    }
    if (status === 'radar' && !radarTake.trim()) {
      setError(`A take is required when status is "${LABELS.radar.full}".`)
      return
    }
    if (imageUrl.trim() && !isRenderableImageUrl(imageUrl.trim())) {
      setError(`The site can't show images hosted on ${imageHost(imageUrl.trim()) ?? 'that site'}. Clear the image URL and upload the image to the gallery instead.`)
      return
    }
    const gtinDigits = gtin.trim() ? normalizeGtin(gtin) : null
    if (gtin.trim() && !gtinDigits) {
      setError('That GTIN / UPC isn\'t valid. It should be 8, 12, 13 or 14 digits, and the last digit is a check digit, so one wrong digit fails. Copy it from under the barcode or clear the field.')
      return
    }

    setBusy(true); setError(null); setUploadStatus(null); setDupWarning(null)

    const parsedPrice = priceCents.trim() ? parseInt(priceCents.trim(), 10) : null

    // Drop blank spec rows; trim values and snap labels to canonical template
    // casing so the same fact reads identically across products (table rows).
    const cleanSpecs = specs
      .map((s) => ({ label: canonicalLabel(s.label), value: s.value.trim() }))
      .filter((s) => s.label && s.value)

    const payload = {
      slug:              slug.trim().toLowerCase(),
      name:              name.trim(),
      brand:             brand.trim() || null,
      model_number:      modelNumber.trim() || null,
      gtin:              gtinDigits,
      ...(allowDuplicateModel ? { allow_duplicate_model: true } : {}),
      specs:             cleanSpecs,
      asin:              asin.trim() || null,
      store,
      custom_store_name: store === 'other' ? (customStoreName.trim() || null) : null,
      affiliate_url:     affiliateUrl.trim() || null,
      non_affiliate_url: nonAffiliateUrl.trim() || null,
      image_url:         imageUrl.trim() || null,
      description:       description.trim() || null,
      category:          category || null,
      price_cents:       !isNaN(parsedPrice!) && parsedPrice !== null ? parsedPrice : null,
      status,
      priority:              parseInt(priority, 10) || 0,
      estimated_review_date: ['queued', 'testing'].includes(status) ? (estimatedDate || null) : null,
      skip_reason:           status === 'passed' ? (skipReason.trim() || null) : null,
      radar_take:            radarTake.trim() || null,
      acquisition:           acquisition || null,
      provided_by:           isConnection ? (providedBy.trim() || null) : null,
      // Only an edited schedule is sent. Cleared = go live now; untouched =
      // omitted, so the trigger stamps entry into Radar.
      ...(status === 'radar' && goLive !== initialGoLive
        ? { spotted_at: (goLive ? new Date(goLive) : new Date()).toISOString() }
        : {}),
      tags,
    }

    try {
      const res = await fetch(
        isNew ? '/api/admin/products' : `/api/admin/products/${product!.id}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const json = await res.json()
      // Same model already in the catalog: a question, not a failure.
      if (res.status === 409 && json.duplicate) {
        setDupWarning(json.error)
        setBusy(false)
        return
      }
      if (!res.ok) throw new Error(json.error ?? 'Save failed')

      // Edit mode: simple redirect, no images to flush.
      if (!isNew) {
        router.push('/dashboard/admin/products')
        return
      }

      // New mode: flush any staged images. If a paste-URL was set, it lands
      // on the product as image_url AT CREATE TIME; the first uploaded image
      // (if any) is_primary=true and the POST /api/media handler auto-syncs
      // products.image_url server-side, so the gallery primary wins.
      const newId: string | undefined = json.product?.id
      if (!newId) {
        router.push('/dashboard/admin/products')
        return
      }

      if (pendingImages.length === 0) {
        router.push(`/dashboard/admin/products/${newId}`)
        return
      }

      setUploadStatus(`Uploading ${pendingImages.length} image${pendingImages.length === 1 ? '' : 's'}…`)
      const result = await flushPendingImages(pendingImages, newId, category || null)

      if (result.failed === 0) {
        // Clean success — go to edit page.
        router.push(`/dashboard/admin/products/${newId}`)
        return
      }

      // Partial failure: product exists, but some images didn't upload. Stop
      // here so the user sees the result and decides when to continue. We
      // park `createdProductId` so re-clicking Save navigates manually.
      setCreatedProductId(newId)
      setUploadStatus(`Uploaded ${result.uploaded} of ${pendingImages.length}. ${result.failed} failed — retry on the edit page.`)
      setError(result.firstError ?? null)
      setBusy(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!product) return
    if (!confirm(`Delete product "${product.name}"? Any [[BUY:${product.slug}]] tokens in future reviews will render as "link missing" until fixed.`)) return
    setDeleting(true); setError(null)
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Delete failed')
      }
      router.push('/dashboard/admin/products')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setDeleting(false)
    }
  }

  async function handleImportImages() {
    if (!product) return
    setImporting(true); setImportResult(null); setError(null)
    try {
      const res  = await fetch(`/api/admin/products/${product.id}/import-amazon-images`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        if (json.error === 'PA_API_NOT_CONFIGURED') {
          setImportResult('PA-API not configured yet — available after 3 qualifying Amazon sales.')
        } else {
          throw new Error(json.error ?? 'Import failed')
        }
      } else {
        setImportResult(`Imported ${json.imported} image${json.imported === 1 ? '' : 's'} from Amazon.`)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // Promote a bench item to a review draft (was the wishlist admin's action).
  // Reuses the existing endpoint, which now operates on the products spine.
  async function handlePromote() {
    if (!product) return
    if (!confirm(`Promote "${product.name}" to a review draft?`)) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/wishlist/${product.id}/promote`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Promote failed')
      router.push(`/dashboard/reviews/${json.review_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Promote failed')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* ── Import from a link ─────────────────────────────────────────── */}
      <Card tone="sunken" className="p-4 space-y-3">
        <div>
          <Eyebrow>Import From a Link</Eyebrow>
          <p className="mt-0.5 text-xs text-prose-faint">
            Paste a product page, or look it up by the model number you type below. Fills empty fields only — nothing saves until you do.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => { setLinkUrl(e.target.value); setLinkSource(null); closePicker(); setPageImages([]); setPageImagesFrom(null); setLookupSources([]) }}
            onKeyDown={(e) => {
              // Enter here imports; it must not submit the product form.
              if (e.key === 'Enter') { e.preventDefault(); handleLinkImport('page') }
            }}
            placeholder="https://www.homedepot.com/p/…  or an Amazon /dp/ link"
            className="flex-1 min-w-0 px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
          />
          <button
            type="button"
            onClick={() => handleLinkImport('page')}
            disabled={!!linkBusy || !linkUrl.trim()}
            className={buttonVariants({ className: 'shrink-0' })}
          >
            {linkBusy === 'page' ? 'Importing…' : 'Import'}
          </button>
        </div>
        {linkNote && <p className="text-xs text-prose-muted">{linkNote}</p>}
        {lookupSources.length > 0 && (
          <div className="text-xs text-prose-muted">
            <p className="mb-1">Sources:</p>
            <ul className="space-y-1.5">
              {lookupSources.map((s) => (
                <li key={s.url} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <button
                    type="button"
                    onClick={() => handleSourceImages(s)}
                    disabled={!!sourceBusy || !!linkBusy}
                    className={buttonVariants({ size: 'sm', variant: 'secondary', className: 'shrink-0' })}
                  >
                    {sourceBusy === s.url ? 'Getting…' : 'Get images'}
                  </button>
                  <span className="min-w-0">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-accent-text hover:underline break-all"
                  >
                    {s.title ?? s.url}
                  </a>
                  {s.supports && <span className="text-prose-faint">{` — ${s.supports}`}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {pageImages.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-prose-muted">
                The page has {pageImages.length} product {pageImages.length === 1 ? 'image' : 'images'} ({imageHost(pageImages[0])}). They&apos;re the site&apos;s own photos; yours are better.
              </p>
              {picker === null && (
                <button
                  type="button"
                  onClick={() => handleChooseImages()}
                  disabled={busy}
                  className={buttonVariants({ size: 'sm', variant: 'secondary' })}
                >
                  Choose images ({pageImages.length})
                </button>
              )}
            </div>
            {pickerLoading && <p className="text-xs text-prose-faint">Loading images…</p>}
            {picker !== null && !pickerLoading && picker.length === 0 && (
              <p className="text-xs text-prose-faint">
                None of those images could be used.{skippedNote && ` ${skippedNote}`}
              </p>
            )}
            {picker !== null && picker.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {picker.map((p) => {
                  const on = picked.has(p.url)
                  return (
                    <label key={p.url} className="block cursor-pointer">
                      <div className={`relative aspect-square overflow-hidden rounded-lg border bg-surface ${on ? 'border-accent ring-2 ring-accent' : 'border-soft'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.previewUrl} alt="" className="w-full h-full object-contain" />
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => togglePicked(p.url)}
                          className="absolute top-1.5 left-1.5 h-5 w-5 accent-accent"
                          aria-label={`Select image ${p.w} by ${p.h}`}
                        />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-prose-faint">
                        <span>{p.w}×{p.h}</span>
                        {isLikelyGraphic(p.url) && <Badge tone="muted" size="sm">Graphic</Badge>}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
            {picker !== null && picker.length > 0 && !pickerLoading && skippedNote && (
              <p className="text-xs text-prose-faint">{skippedNote}</p>
            )}
            {picker !== null && !pickerLoading && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={picked.size === 0 || pickerAdding || busy}
                  className={buttonVariants({ size: 'sm', variant: 'secondary' })}
                >
                  {pickerAdding ? 'Adding…' : `Add selected (${picked.size})`}
                </button>
                <button
                  type="button"
                  onClick={closePicker}
                  disabled={pickerAdding}
                  className={buttonVariants({ size: 'sm', variant: 'secondary' })}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
        {/* The web lookup uses everything entered so far; a typed model number
            turns a guess from a store link into one exact search. */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleLinkImport('lookup')}
            disabled={!!linkBusy || !canLookup}
            className={buttonVariants({ size: 'sm', variant: 'secondary' })}
          >
            {linkBusy === 'lookup' ? 'Searching the web…' : 'Look up details (web search)'}
          </button>
          <p className="text-xs text-prose-faint">
            {canLookup ? `Uses: ${lookupUses.join(', ')}.` : 'Paste a link, or type a model number below, to look it up.'}
            {canLookup && !modelNumber.trim() ? ' Type the model number below for an exact match.' : ''}
          </p>
        </div>
      </Card>

      <div>
        <label className="block text-sm text-prose-muted mb-1.5">
          Slug <span className="text-danger-ink">*</span>
        </label>
        <input
          type="text"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          pattern="[a-z0-9-]+"
          placeholder="enfamil-enspire"
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
        />
        <p className="mt-1 text-xs text-prose-faint">
          Used in tokens: <code className="text-accent-text-soft">[[BUY:{slug || 'your-slug'}]]</code>. Lowercase letters, numbers, hyphens only.
        </p>
        {/* New products only: once saved, tokens and links use the slug. Hidden
            when the slug already is it, or its numbered form (the import's
            dewalt-dcd801b-2 means dewalt-dcd801b is taken). */}
        {isNew && suggestedSlug && !slug.startsWith(suggestedSlug) && (
          <button
            type="button"
            onClick={() => setSlug(suggestedSlug)}
            className={buttonVariants({ size: 'sm', variant: 'secondary', className: 'mt-2' })}
          >
            Use brand + model: {suggestedSlug}
          </button>
        )}
      </div>

      <div>
        <label className="block text-sm text-prose-muted mb-1.5">
          Product name <span className="text-danger-ink">*</span>
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enfamil Enspire"
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
        />
      </div>

      <div>
        <label className="block text-sm text-prose-muted mb-1.5">Brand</label>
        <input
          type="text"
          value={brand}
          onChange={(e) => { setBrand(e.target.value); setDupWarning(null) }}
          placeholder="e.g. Enfamil, DeWalt, Graco"
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
        />
        <p className="mt-1 text-xs text-prose-faint">
          Manufacturer / brand, separate from the product name. Used to ground reviews and compare against other brands.
        </p>
      </div>

      {/* ── Identifiers (mig 159) ─────────────────────────────────────────── */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Model number</label>
          <input
            type="text"
            value={modelNumber}
            onChange={(e) => { setModelNumber(e.target.value); setDupWarning(null) }}
            maxLength={MODEL_NUMBER_MAX}
            placeholder="e.g. DCD801B"
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
          />
          <p className="mt-1 text-xs text-prose-faint">
            The maker&apos;s model / part number for this exact version (tool-only and kit differ). Not a store&apos;s SKU. Shown on the review.
          </p>
        </div>
        <div>
          <label className="block text-sm text-prose-muted mb-1.5">GTIN / UPC</label>
          <input
            type="text"
            inputMode="numeric"
            value={gtin}
            onChange={(e) => setGtin(e.target.value)}
            maxLength={20}
            placeholder="12-digit UPC or 13-digit EAN"
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
          />
          {gtin.trim() && !normalizeGtin(gtin) ? (
            <p className="mt-1 text-xs text-warn-ink">Not a valid barcode number yet: wrong length or check digit.</p>
          ) : (
            <p className="mt-1 text-xs text-prose-faint">
              The number under the barcode. Optional; tells Google exactly which product the review covers.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm text-prose-muted mb-1.5">Store</label>
        <select
          value={store}
          onChange={(e) => setStore(e.target.value)}
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
        >
          {STORE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {store === 'other' && (
        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Store name</label>
          <input
            type="text"
            value={customStoreName}
            onChange={(e) => setCustomStoreName(e.target.value)}
            placeholder="e.g. REI, Costco, Target Canada"
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
          />
          <p className="mt-1 text-xs text-prose-faint">
            Used in the CTA button: &quot;Check Price at [store name]&quot;.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm text-prose-muted mb-1.5">Affiliate URL</label>
        <input
          type="url"
          value={affiliateUrl}
          onChange={(e) => {
            const next = e.target.value
            setAffiliateUrl(next)
            // Auto-extract ASIN when an Amazon URL is pasted — only fill if
            // the ASIN field is empty so we don't clobber a manually-typed one.
            if (store === 'amazon' && !asin.trim()) {
              const found = extractAsin(next)
              if (found) setAsin(found)
            }
          }}
          placeholder={
            store === 'amazon'    ? 'https://www.amazon.com/dp/... — or fill the ASIN below and click Build' :
            store === 'costco'    ? 'No affiliate program — use Non-affiliate URL below' :
            store === 'sams-club' ? 'No affiliate program — use Non-affiliate URL below' :
            'Paste your affiliate link from this retailer\'s program'
          }
          disabled={store === 'costco' || store === 'sams-club'}
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-prose-faint">
          {store === 'amazon'    && 'Use the SiteStripe "Text Only" button on Amazon — your associate tag is embedded automatically.'}
          {store === 'walmart'   && 'Get your link from the Walmart Creator portal (Impact.com). Your publisher ID is embedded in the URL.'}
          {store === 'target'    && 'Get your link from Target\'s affiliate portal (Impact.com). Your publisher ID is embedded in the URL.'}
          {store === 'home-depot' && 'Get your link from Home Depot\'s affiliate portal (Impact.com). Your publisher ID is embedded.'}
          {store === 'lowes'     && "Get your link from Lowe's affiliate portal (CJ Affiliate / cj.com). Your publisher ID is embedded."}
          {store === 'best-buy'  && 'Get your link from Best Buy\'s affiliate portal (Impact.com). Your publisher ID is embedded.'}
          {store === 'rei'       && 'Get your link from REI\'s affiliate portal (Impact.com or Rakuten). Your publisher ID is embedded.'}
          {store === 'dicks'     && "Get your link from Dick's affiliate portal (Impact.com). Your publisher ID is embedded."}
          {store === 'bass-pro'  && 'Get your link from Bass Pro Shops affiliate portal (Impact.com). Your publisher ID is embedded.'}
          {store === 'buckle'    && 'Get your link from Buckle\'s affiliate portal (Rakuten). Your publisher ID is embedded.'}
          {store === 'kohls'     && "Get your link from Kohl's affiliate portal (Rakuten). Your publisher ID is embedded."}
          {store === 'menards'   && 'Menards has limited affiliate availability. If you have a link paste it here — otherwise use Non-affiliate URL.'}
          {store === 'costco'    && '⚠️ Costco has no affiliate program. Use the Non-affiliate URL field below for the direct product link.'}
          {store === 'sams-club' && "⚠️ Sam's Club has no affiliate program. Use the Non-affiliate URL field below for the direct product link."}
          {store === 'other'     && 'Paste your affiliate link from this retailer\'s program. Rendered with rel="sponsored nofollow noopener".'}
        </p>
      </div>

      {store === 'amazon' && (
        <div>
          <label className="block text-sm text-prose-muted mb-1.5">ASIN</label>
          <input
            type="text"
            value={asin}
            onChange={(e) => setAsin(e.target.value)}
            placeholder="B07XYZ1234"
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
          />
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <p className="text-xs text-prose-faint flex-1">10-character Amazon product ID — find it in the product URL after <code className="text-accent-text-soft">/dp/</code></p>
            {isValidAsin(asin) && amazonAssociateTag && (
              <button
                type="button"
                onClick={() => {
                  // Detect SiteStripe long-form URLs by their tracking params.
                  // Rebuilding from ASIN produces a bare /dp/<ASIN>?tag=<tag>
                  // and drops linkCode/linkId/ref_ — confirm before clobbering.
                  if (/[?&](linkCode|linkId|ref_)=/.test(affiliateUrl)) {
                    const ok = window.confirm(
                      'This URL looks like a SiteStripe long-form link ' +
                      '(linkCode / linkId / ref_ tracking params present).\n\n' +
                      'Rebuilding will replace it with a bare ' +
                      `https://www.amazon.com/dp/${asin.trim().toUpperCase()}?tag=${amazonAssociateTag} ` +
                      'and you will lose the SiteStripe tracking params.\n\n' +
                      'Continue?'
                    )
                    if (!ok) return
                  }
                  setAffiliateUrl(buildAmazonAffiliateUrl(asin, amazonAssociateTag))
                }}
                className="text-xs px-3 py-1.5 bg-accent/40 hover:bg-accent/60 text-orange-200 font-semibold rounded-lg transition-colors shrink-0"
                title={`https://www.amazon.com/dp/${asin.trim().toUpperCase()}?tag=${amazonAssociateTag}`}
              >
                {affiliateUrl.trim() ? '↻ Rebuild URL from ASIN' : 'Build affiliate URL'}
              </button>
            )}
            {!isNew && asin.trim() && (
              <button
                type="button"
                onClick={handleImportImages}
                disabled={importing}
                className="text-xs px-3 py-1.5 bg-amber-700/60 hover:bg-amber-600/60 disabled:opacity-40 text-warn-ink font-semibold rounded-lg transition-colors shrink-0"
              >
                {importing ? 'Importing…' : 'Import images from Amazon'}
              </button>
            )}
          </div>
          {importResult && (
            <p className="mt-1.5 text-xs text-forest">{importResult}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm text-prose-muted mb-1.5">
          Non-affiliate URL
          {(store === 'costco' || store === 'sams-club') && (
            <span className="ml-2 text-accent-text-soft text-xs font-semibold">← use this for {store === 'costco' ? 'Costco' : "Sam's Club"}</span>
          )}
        </label>
        <input
          type="url"
          value={nonAffiliateUrl}
          onChange={(e) => setNonAffUrl(e.target.value)}
          placeholder="https://www.costco.com/product.html"
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
        />
        <p className="mt-1 text-xs text-prose-faint">
          {(store === 'costco' || store === 'sams-club')
            ? 'Paste the direct product page URL. Shown as "View [product name]" — no sponsored/nofollow since there\'s no affiliate relationship.'
            : 'Fallback used only when no affiliate URL is set. Rendered without sponsored/nofollow attributes.'
          }
        </p>
      </div>

      {/* Image gallery — only available after the product is created */}
      {!isNew ? (
        <div className="space-y-3">
          <ProductImageGallery
            key={galleryKey}
            productId={product!.id}
            onPrimaryChange={(url) => setImageUrl(url ?? '')}
          />
          <details className="text-xs text-prose-faint">
            <summary className="cursor-pointer hover:text-prose-muted transition-colors">Manual image URL override</summary>
            <div className="mt-2 space-y-1">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... paste a URL directly"
                className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
              />
              {unrenderableImage}
              <p className="text-prose-faint">
                Overrides the gallery primary. The site can only show images from our storage, Amazon (m.media-amazon.com) and Unsplash; upload anything else.
                {store === 'amazon' && ' On the Amazon product page, right-click the main image → Copy image address.'}
              </p>
            </div>
          </details>
        </div>
      ) : (
        <div className="space-y-3">
          <PendingImageGallery
            images={pendingImages}
            onChange={setPendingImages}
            category={category || undefined}
            disabled={busy}
          />

          <details className="text-xs text-prose-faint">
            <summary className="cursor-pointer hover:text-prose-muted transition-colors">Manual URL override (skip the gallery)</summary>
            <div className="mt-2 space-y-1">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... paste a URL directly"
                className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
              />
              {unrenderableImage}
              <p className="text-prose-faint">
                Sets the product&apos;s hero directly. If you also stage gallery images above,
                the one marked Primary will overwrite this on save.
                {store === 'amazon' && ' On the Amazon product page, right-click the main image → Copy image address.'}
              </p>
            </div>
          </details>
        </div>
      )}

      {/* ── Editorial metadata ─────────────────────────────────────────── */}
      <div>
        <label className="block text-sm text-prose-muted mb-1.5">Short description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={400}
          rows={3}
          placeholder="1–2 sentences: what this product is and why it matters. Used as fallback card copy in picks, gift guides, and /stuff."
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
        />
        <p className="mt-1 text-xs text-prose-faint">{description.length}/400 characters</p>
        {retailerRef && (
          <details className="mt-2 text-xs text-prose-faint">
            <summary className="cursor-pointer hover:text-prose-muted transition-colors">
              Retailer&apos;s description — reference only, rewrite in your words
            </summary>
            <p className="mt-2 text-prose-muted whitespace-pre-line">{retailerRef}</p>
            <button
              type="button"
              onClick={() => {
                if (description.trim() && !confirm('Replace your description with the retailer text?')) return
                setDescription(retailerRef.slice(0, 400))
              }}
              className="mt-2 text-accent-text-soft hover:text-accent transition-colors py-1"
            >
              Use as a starting point
            </button>
          </details>
        )}
      </div>

      {/* ── Product Facts (specs) ──────────────────────────────────────── */}
      <Card tone="sunken" className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Eyebrow>Product Facts</Eyebrow>
            <p className="mt-0.5 text-xs text-prose-faint">
              Optional spec sheet — label &amp; value pairs (e.g. Weight → 2.1 lbs). Fed into the AI review draft and brand comparisons. Leave empty if specs are unreliable.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={applyTemplate}
              disabled={atSpecCap}
              title={`Add the suggested ${category ? getCategoryLabel(category) : 'general'} spec labels`}
              className="text-xs px-3 py-2 bg-surface border border-strong hover:border-accent/60 text-prose-muted hover:text-prose font-semibold rounded-lg transition-colors min-h-[36px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply {category ? getCategoryLabel(category) : 'general'} template
            </button>
            <button
              type="button"
              onClick={addSpec}
              disabled={atSpecCap}
              className="text-xs px-3 py-2 bg-surface border border-strong hover:border-accent/60 text-prose-muted hover:text-prose font-semibold rounded-lg transition-colors min-h-[36px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Add spec
            </button>
          </div>
        </div>

        {atSpecCap && (
          <p className="text-xs text-warn-ink">Spec limit reached ({MAX_SPECS}). Remove a row to add more.</p>
        )}

        {specs.length === 0 ? (
          <p className="text-xs text-prose-faint italic">No specs yet. Add facts like dimensions, weight, capacity, material, warranty.</p>
        ) : (
          <div className="space-y-2">
            {specs.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={s.label}
                  onChange={(e) => updateSpec(i, 'label', e.target.value)}
                  maxLength={60}
                  placeholder="Label (e.g. Weight)"
                  className="w-1/3 px-3 py-2 bg-surface border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
                />
                <input
                  type="text"
                  value={s.value}
                  onChange={(e) => updateSpec(i, 'value', e.target.value)}
                  maxLength={200}
                  placeholder={hintFor(s.label)}
                  className="flex-1 px-3 py-2 bg-surface border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
                />
                <button
                  type="button"
                  onClick={() => removeSpec(i)}
                  aria-label="Remove spec"
                  className="shrink-0 px-2.5 py-2 text-danger-ink hover:bg-danger-bg rounded-lg transition-colors min-h-[36px]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* AI autofill — paste a manufacturer/retailer spec sheet, extract facts */}
        <details className="text-xs text-prose-faint border-t border-soft pt-3">
          <summary className="cursor-pointer hover:text-prose-muted transition-colors font-semibold inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-accent-text-soft shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Autofill from a spec sheet (AI)
          </summary>
          <div className="mt-2 space-y-2">
            <p className="text-prose-faint">
              Paste the manufacturer or retailer product copy. Claude extracts brand + specs (aligned to the
              {category ? ` ${getCategoryLabel(category)}` : ''} template) — only facts stated in the text, nothing invented. Existing values you typed are never overwritten.
            </p>
            <textarea
              value={factsText}
              onChange={(e) => setFactsText(e.target.value)}
              maxLength={6000}
              rows={5}
              placeholder="Paste product description, spec table, or bullet points here…"
              className="w-full px-3 py-2 bg-surface border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleAutofill}
                disabled={autofilling || !factsText.trim()}
                className={buttonVariants({ size: 'sm' })}
              >
                {autofilling ? 'Extracting…' : 'Extract facts'}
              </button>
              {autofillNote && <span className="text-prose-muted">{autofillNote}</span>}
            </div>
          </div>
        </details>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
          >
            <option value="">— none —</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Price (cents)</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={priceCents}
            onChange={(e) => setPriceCents(e.target.value.replace(/\D/g, ''))}
            placeholder="e.g. 2999 = $29.99"
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
          />
          {priceCents && !isNaN(parseInt(priceCents, 10)) && (
            <p className="mt-1 text-xs text-accent-text-soft">${(parseInt(priceCents, 10) / 100).toFixed(2)}</p>
          )}
        </div>
      </div>

      {/* ── Tags ───────────────────────────────────────────────────────── */}
      <Card tone="sunken" className="p-4 space-y-3">
        <div>
          <Eyebrow>Tags</Eyebrow>
          <p className="mt-0.5 text-xs text-prose-faint">
            Topic &amp; facet tags for cross-cutting discovery (a product can carry tags from other pillars). Curated vocabulary — see docs/pillar-taxonomy.md.
          </p>
        </div>
        <TagPicker selected={tags} onChange={setTags} />
      </Card>

      <div>
        <label className="block text-sm text-prose-muted mb-1.5">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
        >
          {PRODUCT_STATUS_OPTIONS.map((s) => (
            // Reviewed is a fact the database sets when the review is approved
            // (mig 158), never a choice — selectable only to keep it as-is.
            <option key={s.value} value={s.value} disabled={s.value === 'reviewed' && product?.status !== 'reviewed'}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-prose-faint">
          Catalog = private, no claim (buy links, gift guides, showcasing). {LABELS.radar.full} shows on /gear with your take. Up Next / Testing Now show on the Bench. Reviewed is set automatically when the review is approved.
        </p>
      </div>

      {/* ── On the Radar ───────────────────────────────────────────────── */}
      {(status === 'radar' || wasOnRadar) && (
        <Card tone="sunken" className="p-4 space-y-4">
          <div>
            <Eyebrow>{LABELS.radar.full}</Eyebrow>
            {status !== 'radar' && (
              <p className="mt-0.5 text-xs text-prose-faint">
                No longer on the radar. The take stays on the archive with its outcome.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-prose-muted mb-1.5">
              Take {status === 'radar' && <span className="text-danger-ink">*</span>}{' '}
              <span className="text-prose-faint font-normal">(shown publicly)</span>
            </label>
            <textarea
              value={radarTake}
              onChange={(e) => setRadarTake(e.target.value)}
              maxLength={RADAR_TAKE_MAX}
              rows={4}
              required={status === 'radar'}
              placeholder="Why a dad would care, plus one honest reservation. Not tested, so no testing claims."
              className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
            />
            <p className="mt-1 text-xs text-prose-faint">{radarTake.length}/{RADAR_TAKE_MAX} characters</p>
          </div>

          {status === 'radar' && (
            <div>
              <label className="block text-sm text-prose-muted mb-1.5">Goes live</label>
              <input
                type="datetime-local"
                value={inBrowser ? goLive : ''}
                onChange={(e) => setGoLive(e.target.value)}
                disabled={!inBrowser}
                className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
              />
              <p className="mt-1 text-xs text-prose-faint">
                Empty = live on save. A future time schedules it: the card stays off /gear until then. Your local time.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* ── How I got it ───────────────────────────────────────────────── */}
      <Card tone="sunken" className="p-4 space-y-4">
        <div>
          <Eyebrow>How I Got It</Eyebrow>
          <p className="mt-0.5 text-xs text-prose-faint">
            Leave blank unless it&apos;s true — blank makes no claim. A brand-provided or loaned unit shows the required disclosure wherever the product is reviewed or recommended.
          </p>
        </div>
        <select
          value={acquisition}
          onChange={(e) => setAcquisition(e.target.value as ProductAcquisition | '')}
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
        >
          <option value="">Not set (no claim)</option>
          {ACQUISITION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {isConnection && (
          <div>
            <label className="block text-sm text-prose-muted mb-1.5">Provided by</label>
            <input
              type="text"
              value={providedBy}
              onChange={(e) => setProvidedBy(e.target.value)}
              maxLength={120}
              placeholder={brand.trim() ? `Blank = ${brand.trim()}` : 'Brand, retailer or PR agency'}
              className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
            />
            <p className="mt-2 text-xs text-prose-muted">
              Readers see: <span className="italic">{acquisitionDisclosure({ acquisition, provided_by: providedBy, brand })}</span>
            </p>
          </div>
        )}
      </Card>

      {/* ── Bench pipeline ─────────────────────────────────────────────── */}
      <Card tone="sunken" className="p-4 space-y-4">
        <Eyebrow>Bench Pipeline</Eyebrow>
        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Priority</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
          />
          <p className="mt-1 text-xs text-prose-faint">Higher shows first on the bench &amp; homepage rail.</p>
        </div>

        {['queued', 'testing'].includes(status) && (
          <div>
            <label className="block text-sm text-prose-muted mb-1.5">Estimated review date</label>
            <input
              type="date"
              value={estimatedDate}
              onChange={(e) => setEstimatedDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
            />
          </div>
        )}

        {status === 'passed' && (
          <div>
            <label className="block text-sm text-prose-muted mb-1.5">
              Skip reason <span className="text-danger-ink">*</span>{' '}
              <span className="text-prose-faint font-normal">(shown publicly)</span>
            </label>
            <textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              rows={2}
              required
              placeholder="Not enough differentiation from products I've already reviewed."
              className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
            />
          </div>
        )}
      </Card>

      {/* Linked review badge */}
      {product?.review_id && (
        <div className="px-4 py-3 bg-accent-tint border border-accent-border/50 rounded-xl text-sm">
          <span className="text-accent-text-soft font-semibold">Promoted to review</span>
          <span className="text-prose-muted ml-2">Review ID: {product.review_id}</span>
        </div>
      )}

      {error && (
        <p className="text-danger-ink text-sm bg-danger-bg border border-danger-line rounded-lg px-4 py-3">{error}</p>
      )}

      {dupWarning && (
        <div className="text-sm text-warn-ink bg-warn-bg border border-amber-900/40 rounded-lg px-4 py-3 space-y-3">
          <p>{dupWarning}</p>
          <button
            type="button"
            onClick={(e) => handleSave(e, { allowDuplicateModel: true })}
            disabled={busy}
            className={buttonVariants({ size: 'sm', variant: 'secondary' })}
          >
            Save anyway
          </button>
        </div>
      )}

      {uploadStatus && (
        <p className={`text-sm rounded-lg px-4 py-3 ${
          createdProductId
            ? 'text-warn-ink bg-warn-bg border border-amber-900/40'
            : 'text-prose-muted bg-surface border border-soft'
        }`}>
          {uploadStatus}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2 flex-wrap">
        <button
          type="submit"
          disabled={busy || !slug.trim() || !name.trim()}
          className={buttonVariants()}
        >
          {busy
            ? 'Saving…'
            : createdProductId
              ? 'Continue to product →'
              : isNew
                ? 'Create product'
                : 'Save changes'}
        </button>
        {!isNew && !product!.review_id && status !== 'reviewed' && (
          <button
            type="button"
            onClick={handlePromote}
            disabled={busy}
            className={buttonVariants({ variant: 'secondary' })}
          >
            Promote to Review
          </button>
        )}
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="ml-auto px-5 py-2.5 text-danger-ink hover:text-danger-ink text-sm transition-colors disabled:opacity-40"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  )
}
