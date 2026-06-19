'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { OCCASIONS, OCCASION_GROUPS } from '@/lib/gift-occasions'
import { HeroImagePanel } from '@/components/workspace/HeroImagePanel'
import { TiptapEditor } from '@/components/workspace/TiptapEditor'
import { SchedulePanel } from '@/components/workspace/SchedulePanel'

// InlineMediaPanel is heavy + drags in image upload UI — load lazy.
const InlineMediaPanel = dynamic(
  () => import('@/components/workspace/InlineMediaPanel').then((m) => ({ default: m.InlineMediaPanel })),
  { ssr: false },
)

interface ReviewSummary {
  id: string
  slug: string
  title: string
  product_name: string
  category?: string | null
  rating: number | null
  image_url: string | null
  product_slug?: string | null
}

interface PickItem {
  id?: string
  review_id: string
  position: number
  blurb: string | null
  wins_category?: string | null
  role_label?: string | null
  best_for?: string | null
  // Resolved server-side from products.price_cents via the review's product_slug.
  // Only used in the workspace for the price-range readout — not persisted.
  price_cents?: number | null
  reviews?: ReviewSummary | ReviewSummary[] | null
}

export interface CollectionFAQ {
  question: string
  answer:   string
}

interface PickList {
  id: string
  slug: string
  title: string
  description: string | null
  intro_html: string | null
  hero_image_url: string | null
  is_visible: boolean
  published_at: string | null
  collection_type?: string | null
  occasion?: string | null
  winner_summary?: string | null
  bundle_total_cents?: number | null
  meta_title?: string | null
  meta_description?: string | null
  scheduled_publish_at?: string | null
  // Editorial overrides — migration 068. Null falls back to category defaults
  // on public pages (lib/categories.ts pov + faqs).
  methodology_html?: string | null
  faqs?: CollectionFAQ[] | null
}

interface Props {
  pick: PickList | null
  initialItems: PickItem[]
}

// Per-flavor copy for the role_label field. Comparison uses wins_category
// instead — semantically distinct (winner-per-criterion vs. editorial tag).
const ROLE_LABEL_CONFIG: Record<string, { label: string; placeholder: string; help: string } | null> = {
  gift_guide: {
    label:       'Gift tag',
    placeholder: "e.g. 'For the New Dad', 'Splurge Pick', 'Under $25'",
    help:        'Shows as the chip above the product name on the gift card.',
  },
  best_of: {
    label:       'Best-of role',
    placeholder: "e.g. 'Best Overall', 'Best Budget', 'Best for Beginners'",
    help:        'One "Best Overall" — make sure the top pick claims it.',
  },
  general: {
    label:       'Editorial tag',
    placeholder: "e.g. 'Top Pick', 'Runner-up', 'Hidden Gem'",
    help:        'Shows as the chip above the product name.',
  },
  stack: {
    label:       'Role in the stack',
    placeholder: "e.g. 'The Anchor', 'Daily Driver', 'Recovery Backbone'",
    help:        "Tie to the piece's function inside the kit, not generic strengths.",
  },
  comparison: null,
}

// Soft title-case lint — flags titles that are all-lowercase, that contain
// "fathers day" / "mothers day" style apostrophe drops, or that lead with a
// lowercase character. Non-blocking; renders a small amber hint.
function titleLint(t: string): string | null {
  const v = t.trim()
  if (v.length === 0) return null
  if (/^[a-z]/.test(v)) return 'Title starts with a lowercase letter.'
  if (/^[a-z0-9\s-]+$/.test(v)) return 'Title is all lowercase — consider Title Case.'
  if (/\bfathers day\b/i.test(v))   return "“Fathers Day” usually wants an apostrophe — “Father's Day”."
  if (/\bmothers day\b/i.test(v))   return "“Mothers Day” usually wants an apostrophe — “Mother's Day”."
  if (/\bvalentines day\b/i.test(v))return "“Valentines Day” usually wants an apostrophe — “Valentine's Day”."
  if (/\bnew years\b/i.test(v) && !/new year['’]s/i.test(v)) return "“New Years” usually wants an apostrophe — “New Year's”."
  return null
}

// Build the "$17 – $350" readout for the workspace. Returns null when no item
// has a resolved price — the workspace then shows a "missing prices" warning
// instead of an empty pill.
function priceRangeSummary(items: PickItem[]): {
  min: number; max: number; priced: number; total: number
} | null {
  const cents = items
    .map((i) => i.price_cents)
    .filter((c): c is number => typeof c === 'number' && c > 0)
  if (cents.length === 0) return null
  return {
    min:    Math.min(...cents),
    max:    Math.max(...cents),
    priced: cents.length,
    total:  items.length,
  }
}

export function PickForm({ pick, initialItems }: Props) {
  const router = useRouter()
  const isNew = !pick

  const [slug, setSlug]         = useState(pick?.slug ?? '')
  const [title, setTitle]       = useState(pick?.title ?? '')
  const [description, setDesc]  = useState(pick?.description ?? '')
  const [introHtml, setIntro]   = useState(pick?.intro_html ?? '')
  const [heroUrl, setHeroUrl]   = useState(pick?.hero_image_url ?? '')
  const [visible, setVisible]   = useState(pick?.is_visible ?? false)
  const [pickType, setPickType]           = useState<string>(pick?.collection_type ?? 'general')
  const [occasion, setOccasion]           = useState<string>(pick?.occasion ?? '')
  const [winnerSummary, setWinnerSummary] = useState<string>(pick?.winner_summary ?? '')
  const [bundleTotalCents, setBundleTotal] = useState<string>(pick?.bundle_total_cents != null ? String(pick.bundle_total_cents) : '')
  const [metaTitle, setMetaTitle]         = useState<string>(pick?.meta_title ?? '')
  const [metaDescription, setMetaDesc]    = useState<string>(pick?.meta_description ?? '')
  const [scheduledAt, setScheduledAt]     = useState<string | null>(pick?.scheduled_publish_at ?? null)
  const [items, setItems]       = useState<PickItem[]>(
    initialItems.map((i, idx) => ({ ...i, position: i.position ?? idx }))
  )

  // Editorial overrides (migration 068). When blank, public pages pull the
  // dominant category's pov + faqs from lib/categories.ts as fallback.
  const [methodologyHtml, setMethodologyHtml] = useState<string>(pick?.methodology_html ?? '')
  const [faqs, setFaqs]                       = useState<CollectionFAQ[]>(pick?.faqs ?? [])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ReviewSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy]     = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [slugTaken, setSlugTaken] = useState<{ type: string } | null>(null)

  // ── Readiness checklist ───────────────────────────────────────────────────
  // Mirrors the pattern in ReviewWorkspace/GuideWorkspace. The list of checks
  // depends on collection_type because each flavor needs different ingredients
  // to render well.
  function buildReadiness(): { label: string; done: boolean; required: boolean }[] {
    const checks: { label: string; done: boolean; required: boolean }[] = [
      { label: 'Title',  done: title.trim().length >= 2, required: true },
      { label: 'Slug',   done: /^[a-z0-9-]{2,}$/.test(slug.trim()), required: true },
      { label: 'Description', done: description.trim().length > 0, required: false },
      { label: 'Hero image',  done: !!heroUrl.trim(), required: false },
    ]

    if (pickType === 'comparison') {
      checks.push({ label: '≥ 2 contenders', done: items.length >= 2, required: true })
      checks.push({ label: 'Bottom-line summary',  done: winnerSummary.trim().length > 0, required: false })
      const taggedCount = items.filter((i) => (i.wins_category ?? '').trim().length > 0).length
      checks.push({ label: `Winner badges (${taggedCount}/${items.length})`, done: items.length > 0 && taggedCount === items.length, required: false })
    } else if (pickType === 'stack') {
      checks.push({ label: '≥ 1 item', done: items.length >= 1, required: true })
      const taggedCount = items.filter((i) => (i.role_label ?? '').trim().length > 0).length
      checks.push({ label: `Role labels (${taggedCount}/${items.length})`, done: items.length > 0 && taggedCount === items.length, required: false })
    } else if (pickType === 'gift_guide') {
      checks.push({ label: 'Occasion selected', done: occasion.trim().length > 0, required: true })
      checks.push({ label: '≥ 1 item', done: items.length >= 1, required: true })
    } else {
      // general / best_of
      checks.push({ label: '≥ 1 item', done: items.length >= 1, required: true })
    }

    return checks
  }
  const readiness = buildReadiness()
  const requiredMissing = readiness.filter((c) => c.required && !c.done).length

  // ── Derived hero-image category ───────────────────────────────────────────
  // Collections don't have their own category column. Derive one from the most
  // common category across linked review items so the AI image generator gets
  // a thematic prompt (e.g. "baby-gear" → editorial nursery scene) instead of
  // the generic "other" fallback.
  function deriveCategory(): string {
    const counts: Record<string, number> = {}
    for (const item of items) {
      const review = getReview(item)
      const cat = review?.category
      if (cat) counts[cat] = (counts[cat] ?? 0) + 1
    }
    let best: string | null = null
    let bestCount = 0
    for (const [cat, n] of Object.entries(counts)) {
      if (n > bestCount) { best = cat; bestCount = n }
    }
    return best ?? 'other'
  }
  const heroCategory = deriveCategory()

  // ── Slug uniqueness pre-check (debounced) ─────────────────────────────────
  // Friendly warning before the editor saves and hits a 409. Skips its own id
  // when editing so the editor's existing slug doesn't flag itself.
  useEffect(() => {
    const s = slug.trim().toLowerCase()
    if (s.length < 2) { setSlugTaken(null); return }
    // Editing an existing collection with its original slug? No need to check.
    if (pick && pick.slug === s) { setSlugTaken(null); return }
    const handle = setTimeout(async () => {
      try {
        const url = `/api/admin/picks/slug-check?slug=${encodeURIComponent(s)}${pick ? `&exclude=${pick.id}` : ''}`
        const res = await fetch(url)
        if (!res.ok) return
        const json = await res.json()
        setSlugTaken(json.exists ? { type: json.type ?? 'general' } : null)
      } catch { /* network blip — silently skip */ }
    }, 350)
    return () => clearTimeout(handle)
  }, [slug, pick])

  // ── AI intro generation + refine ──────────────────────────────────────────
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [refineInstruction, setRefineInstruction] = useState('')

  async function callIntroAI(refine: boolean) {
    if (items.length < 2) { setAiError('Add at least 2 reviews before generating'); return }
    setAiBusy(true); setAiError(null)
    try {
      const res = await fetch('/api/claude/collection-intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionType: pickType,
          title:          title || 'Untitled collection',
          description:    description || null,
          itemReviewIds:  items.map((i) => i.review_id),
          currentHtml:    refine ? introHtml : undefined,
          instruction:    refine ? refineInstruction.trim() : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generation failed')
      setIntro(json.html ?? '')
      if (refine) setRefineInstruction('')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Generation failed')
    }
    setAiBusy(false)
  }

  // ── AI: fill per-pick blurbs + role labels + flavor-aware FAQs ───────────
  // Single shot. Updates the items state and (when no FAQs are already
  // customized) the FAQ override panel. We never clobber edits the user has
  // already typed — existing blurb/role_label values stay untouched.
  const [fillBusy, setFillBusy]   = useState(false)
  const [fillError, setFillError] = useState<string | null>(null)
  const [fillNote, setFillNote]   = useState<string | null>(null)

  async function callFillAI() {
    if (items.length < 1) { setFillError('Add at least one pick first'); return }
    setFillBusy(true); setFillError(null); setFillNote(null)
    try {
      const res = await fetch('/api/claude/collection-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionType: pickType,
          title:          title || 'Untitled collection',
          description:    description || null,
          itemReviewIds:  items.map((i) => i.review_id),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generation failed')

      const blurbsById = new Map<string, string>()
      for (const b of (json.blurbs ?? []) as Array<{ id: string; blurb: string }>) blurbsById.set(b.id, b.blurb)
      const rolesById = new Map<string, string>()
      for (const r of (json.roleLabels ?? []) as Array<{ id: string; label: string }>) rolesById.set(r.id, r.label)

      let blurbsFilled = 0
      let rolesFilled  = 0
      setItems((prev) => prev.map((i) => {
        let next = i
        const aiBlurb = blurbsById.get(i.review_id)
        if (aiBlurb && !(i.blurb ?? '').trim()) { next = { ...next, blurb: aiBlurb }; blurbsFilled++ }
        const aiRole = rolesById.get(i.review_id)
        if (aiRole && pickType !== 'comparison' && !(i.role_label ?? '').trim()) {
          next = { ...next, role_label: aiRole }; rolesFilled++
        }
        return next
      }))

      let faqsFilled = 0
      if (faqs.length === 0 && Array.isArray(json.faqs) && json.faqs.length > 0) {
        setFaqs(json.faqs.slice(0, 12))
        faqsFilled = json.faqs.length
      }

      const noteParts: string[] = []
      if (blurbsFilled > 0) noteParts.push(`${blurbsFilled} blurb${blurbsFilled === 1 ? '' : 's'}`)
      if (rolesFilled  > 0) noteParts.push(`${rolesFilled} role label${rolesFilled === 1 ? '' : 's'}`)
      if (faqsFilled   > 0) noteParts.push(`${faqsFilled} FAQ${faqsFilled === 1 ? '' : 's'}`)
      setFillNote(noteParts.length > 0 ? `Filled ${noteParts.join(', ')}. Existing edits were preserved.` : 'Nothing to fill — every slot already has content.')
    } catch (err) {
      setFillError(err instanceof Error ? err.message : 'Generation failed')
    }
    setFillBusy(false)
  }

  function getReview(item: PickItem): ReviewSummary | null {
    if (!item.reviews) return null
    return Array.isArray(item.reviews) ? item.reviews[0] ?? null : item.reviews
  }

  async function searchReviews(q: string) {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}&type=review&limit=8`)
    if (res.ok) {
      const json = await res.json()
      // API returns { articles, reviews, media }; only show approved reviews so
      // drafts/pending/rejected entries can't be added to public collections.
      const reviews = (json.reviews ?? []) as Array<ReviewSummary & { status?: string }>
      setSearchResults(reviews.filter((r) => r.status === 'approved'))
    }
    setSearching(false)
  }

  function addItem(review: ReviewSummary) {
    if (items.some((i) => i.review_id === review.id)) return
    setItems((prev) => [
      ...prev,
      { review_id: review.id, position: prev.length, blurb: null, reviews: review },
    ])
    setSearchQuery('')
    setSearchResults([])
  }

  function removeItem(review_id: string) {
    setItems((prev) => prev.filter((i) => i.review_id !== review_id).map((i, idx) => ({ ...i, position: idx })))
  }

  function moveItem(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]]
      return next.map((i, j) => ({ ...i, position: j }))
    })
  }

  function updateBlurb(review_id: string, blurb: string) {
    setItems((prev) => prev.map((i) => i.review_id === review_id ? { ...i, blurb: blurb || null } : i))
  }

  function updateWinsCategory(review_id: string, wins_category: string) {
    setItems((prev) => prev.map((i) => i.review_id === review_id ? { ...i, wins_category: wins_category || null } : i))
  }

  function updateRoleLabel(review_id: string, role_label: string) {
    setItems((prev) => prev.map((i) => i.review_id === review_id ? { ...i, role_label: role_label || null } : i))
  }

  function updateBestFor(review_id: string, best_for: string) {
    setItems((prev) => prev.map((i) => i.review_id === review_id ? { ...i, best_for: best_for || null } : i))
  }

  // Where this collection lives on the public site once visible. Falls back
  // to null when the slug is empty (new draft) or when a gift guide has no
  // occasion picked yet — without that piece the URL doesn't resolve.
  function getPublicPath(): string | null {
    const s = slug.trim().toLowerCase()
    if (!s) return null
    if (pickType === 'gift_guide') {
      const occ = OCCASIONS.find((o) => o.value === occasion)
      return occ ? `/gifts/${occ.slug}` : null
    }
    if (pickType === 'comparison') return `/comparisons/${s}`
    if (pickType === 'stack')      return `/stacks/${s}`
    return `/picks/${s}` // general, best_of
  }
  const publicPath = getPublicPath()

  async function handleSave(e: React.FormEvent | null, opts?: { visible?: boolean }) {
    if (e) e.preventDefault()
    setBusy(true); setError(null); setSavedAt(null)
    const visibleValue = opts?.visible ?? visible

    const parsedBundleTotal = bundleTotalCents.trim() ? parseInt(bundleTotalCents.trim(), 10) : null

    const payload = {
      slug: slug.trim().toLowerCase(),
      title: title.trim(),
      description: description.trim() || null,
      intro_html: introHtml.trim() || null,
      hero_image_url: heroUrl.trim() || null,
      is_visible: visibleValue,
      collection_type: pickType,
      occasion: pickType === 'gift_guide' ? (occasion || null) : null,
      winner_summary: pickType === 'comparison' ? (winnerSummary.trim() || null) : null,
      bundle_total_cents: pickType === 'stack' && parsedBundleTotal !== null && !isNaN(parsedBundleTotal) ? parsedBundleTotal : null,
      meta_title:           metaTitle.trim() || null,
      meta_description:     metaDescription.trim() || null,
      scheduled_publish_at: scheduledAt,
      // Editorial overrides (migration 068)
      methodology_html:     methodologyHtml.trim() || null,
      faqs:                 faqs.length > 0 ? faqs : null,
      items: items.map((i) => ({
        review_id:     i.review_id,
        position:      i.position,
        blurb:         i.blurb,
        // Comparison alone uses wins_category (winner-per-criterion). Every
        // other flavor uses role_label as the per-item chip — gift-guides
        // ("Splurge Pick"), best-of ("Best Overall"), picks ("Top Pick"),
        // stacks ("The Anchor").
        wins_category: pickType === 'comparison' ? (i.wins_category ?? null) : null,
        role_label:    pickType === 'comparison' ? null : ((i.role_label ?? '').trim() || null),
        // best_for is an optional secondary "best for X" line. Allow on every
        // flavor — gift-guide cards benefit from it too.
        best_for:      ((i.best_for ?? '').trim() || null),
      })),
    }

    try {
      const res = await fetch(
        isNew ? '/api/admin/picks' : `/api/admin/picks/${pick!.id}`,
        { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')

      if (isNew) {
        router.push(`/dashboard/admin/picks/${json.pick.id}`)
        // Stay busy through the navigation — the destination remounts the form.
      } else {
        if (opts?.visible !== undefined) setVisible(opts.visible)
        router.refresh()
        setSavedAt(new Date().toLocaleTimeString())
        setBusy(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!pick) return
    if (!confirm(`Delete "${pick.title}"? This cannot be undone.`)) return
    setDeleting(true)
    const res = await fetch(`/api/admin/picks/${pick.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/dashboard/admin/picks')
    } else {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Delete failed')
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Metadata */}
      <div className="space-y-4">
        <div>
          <label htmlFor="pf-slug" className="block text-sm text-prose-muted mb-1.5">Slug <span className="text-danger-ink">*</span></label>
          <input
            id="pf-slug"
            type="text" required value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())}
            pattern="[a-z0-9-]+" placeholder="fathers-day-gift-guide"
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover text-base"
          />
          <p className="mt-1 text-xs text-prose-faint">
            Public URL: {pickType === 'comparison'
              ? `/comparisons/${slug || 'your-slug'}`
              : pickType === 'stack'
              ? `/stacks/${slug || 'your-slug'}`
              : pickType === 'gift_guide'
              ? `/gifts/${slug || 'your-slug'}`
              : `/picks/${slug || 'your-slug'}`}
          </p>
          {slugTaken && (
            <p className="mt-1 text-xs text-warn-ink">
              ⚠ Slug already in use by an existing <strong className="font-semibold">{slugTaken.type === 'gift_guide' ? 'gift guide' : slugTaken.type === 'best_of' ? 'best-of list' : slugTaken.type}</strong>. Saving will fail until you pick a different one.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="pf-title" className="block text-sm text-prose-muted mb-1.5">Title <span className="text-danger-ink">*</span></label>
          <input
            id="pf-title"
            type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Father's Day Gift Guide 2026"
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover text-base"
          />
          {titleLint(title) && (
            <p className="mt-1 text-xs text-warn-ink">⚠ {titleLint(title)}</p>
          )}
        </div>

        <div>
          <label htmlFor="pf-description" className="block text-sm text-prose-muted mb-1.5">Short description <span className="text-prose-faint">(shows on index cards)</span></label>
          <input
            id="pf-description"
            type="text" value={description} onChange={(e) => setDesc(e.target.value)}
            placeholder="Dad-tested picks that actually earn a spot in the garage or kitchen."
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover text-base"
          />
        </div>

        <div>
          <div className="flex items-end justify-between mb-1.5 gap-2 flex-wrap">
            <label className="block text-sm text-prose-muted">
              Editorial intro <span className="text-prose-faint">(shows above the body of the detail page)</span>
            </label>
            <button
              type="button"
              onClick={() => callIntroAI(false)}
              disabled={aiBusy || items.length < 2}
              className="text-xs px-3 py-1.5 bg-accent/40 hover:bg-accent/60 disabled:opacity-40 text-orange-200 font-semibold rounded-lg transition-colors min-h-[32px]"
              title={items.length < 2 ? 'Add at least 2 reviews first' : 'Generate intro with AI'}
            >
              {aiBusy && !refineInstruction ? '✨ Generating…' : introHtml.trim() ? '↻ Regenerate with AI' : '✨ Generate with AI'}
            </button>
          </div>
          <TiptapEditor
            value={introHtml}
            onChange={setIntro}
            placeholder="Tell the reader why this collection exists. A few sentences of context that frame the picks below…"
          />

          {/* Inline AI refine — short instruction reshapes the current intro */}
          {introHtml.trim() && (
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={refineInstruction}
                onChange={(e) => setRefineInstruction(e.target.value)}
                placeholder="Refine instruction — e.g. 'tighter', 'more dad voice', 'lead with the testing scenario'…"
                className="flex-1 px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover text-sm"
              />
              <button
                type="button"
                onClick={() => callIntroAI(true)}
                disabled={aiBusy || !refineInstruction.trim() || items.length < 2}
                className="shrink-0 text-xs px-3 py-2 bg-surface-raised hover:bg-surface disabled:opacity-40 text-prose font-semibold rounded-lg transition-colors min-h-[36px]"
              >
                {aiBusy && refineInstruction ? 'Refining…' : 'Refine →'}
              </button>
            </div>
          )}

          {aiError && (
            <p className="mt-2 text-xs text-danger-ink bg-danger-bg border border-danger-line rounded-lg px-3 py-2">{aiError}</p>
          )}

          {/* Inline images — manages bd-image-placeholder figures inside the intro */}
          <div className="mt-3 bg-surface-sunken/60 border border-soft rounded-xl p-4">
            <p className="text-xs text-prose-faint font-medium uppercase tracking-widest mb-3">Inline images</p>
            <InlineMediaPanel
              content={introHtml}
              onChangeContent={setIntro}
              category={heroCategory}
            />
          </div>
        </div>

        <HeroImagePanel
          imageUrl={heroUrl || null}
          onChange={(url) => setHeroUrl(url ?? '')}
          label="Hero image"
          contentType="guide"
          title={title}
          category={heroCategory}
          excerpt={description}
        />
        <p className="-mt-3 text-xs text-prose-faint">
          📷 Take a real photo, 📁 pick from the media library, or generate an editorial scene with AI.
        </p>

        <div>
          <label htmlFor="pf-type" className="block text-sm text-prose-muted mb-1.5">Collection type</label>
          <select
            id="pf-type"
            value={pickType} onChange={(e) => setPickType(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover text-base"
          >
            <option value="general">Pick (general curated list, /picks)</option>
            <option value="best_of">Best Of (ranked category list, /picks)</option>
            <option value="gift_guide">Gift Guide (by occasion, /gifts)</option>
            <option value="comparison">Comparison (head-to-head, /comparisons)</option>
            <option value="stack">Stack (kit for a goal, /stacks)</option>
          </select>
        </div>

        {pickType === 'comparison' && (
          <div>
            <label htmlFor="pf-bottom-line" className="block text-sm text-prose-muted mb-1.5">
              Bottom line <span className="text-prose-faint">(one-line verdict shown above the scorecard)</span>
            </label>
            <textarea
              id="pf-bottom-line"
              value={winnerSummary}
              onChange={(e) => setWinnerSummary(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Buy the Yeti for everyday use, the RTIC if you need it bigger, and skip the Igloo unless you're on a budget."
              className="w-full px-4 py-3 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none text-base"
            />
            <p className="mt-1 text-xs text-prose-faint">{winnerSummary.length}/500</p>
          </div>
        )}

        {pickType === 'stack' && (
          <div>
            <label htmlFor="pf-bundle-total" className="block text-sm text-prose-muted mb-1.5">
              Bundle total <span className="text-prose-faint">(cents — optional; otherwise computed from items)</span>
            </label>
            <input
              id="pf-bundle-total"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={bundleTotalCents}
              onChange={(e) => setBundleTotal(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 49999 = $499.99"
              className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover text-base"
            />
            {bundleTotalCents && !isNaN(parseInt(bundleTotalCents, 10)) && (
              <p className="mt-1 text-xs text-accent-text-soft">${(parseInt(bundleTotalCents, 10) / 100).toFixed(2)}</p>
            )}
          </div>
        )}

        {pickType === 'gift_guide' && (
          <div>
            <label htmlFor="pf-occasion" className="block text-sm text-prose-muted mb-1.5">Occasion <span className="text-danger-ink">*</span></label>
            <select
              id="pf-occasion"
              value={occasion} onChange={(e) => setOccasion(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover text-base"
            >
              <option value="">Select an occasion…</option>
              {OCCASION_GROUPS.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {OCCASIONS.filter((o) => o.group === group.id).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-xs text-prose-faint">
              This list will replace any previous gift guide for this occasion at <code className="text-accent-text-soft">/gifts/{OCCASIONS.find((o) => o.value === occasion)?.slug ?? '[occasion]'}</code>
            </p>
          </div>
        )}

        {/* Schedule publish — flip is_visible automatically at a future time */}
        <SchedulePanel
          scheduledAt={scheduledAt}
          onChange={setScheduledAt}
          disabled={visible}
        />
        {visible && scheduledAt && (
          <p className="-mt-3 text-xs text-warn-ink">
            ⚠ This collection is already live. Clear the schedule, or unpublish first to schedule a future drop.
          </p>
        )}

        {/* SEO overrides — collapsible since they're optional */}
        <details className="group rounded-xl bg-surface-sunken/60 border border-soft">
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 min-h-[44px]">
            <div>
              <p className="text-sm font-semibold text-prose">SEO overrides</p>
              <p className="text-xs text-prose-faint">Optional. Fall back to title + description if left empty.</p>
            </div>
            <svg className="w-4 h-4 text-prose-faint group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-4 pb-4 pt-1 space-y-3 border-t border-soft">
            <div>
              <label htmlFor="pf-meta-title" className="block text-xs text-prose-muted mb-1.5">
                Meta title <span className="text-prose-faint">(HTML &lt;title&gt; tag; ~70 char limit)</span>
              </label>
              <input
                id="pf-meta-title"
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                maxLength={120}
                placeholder={title ? `${title.slice(0, 60)}${title.length > 60 ? '…' : ''}` : 'Defaults to title'}
                className="w-full px-3 py-2 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover text-sm"
              />
              <p className="mt-1 text-xs text-prose-faint tabular-nums">{metaTitle.length}/120</p>
            </div>
            <div>
              <label htmlFor="pf-meta-desc" className="block text-xs text-prose-muted mb-1.5">
                Meta description <span className="text-prose-faint">(search snippet; ~155 char limit)</span>
              </label>
              <textarea
                id="pf-meta-desc"
                value={metaDescription}
                onChange={(e) => setMetaDesc(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder={description || 'Defaults to short description'}
                className="w-full px-3 py-2 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover text-sm resize-none"
              />
              <p className="mt-1 text-xs text-prose-faint tabular-nums">{metaDescription.length}/300</p>
            </div>
          </div>
        </details>

        {/* Methodology override — collapsible. Falls back to the dominant
            item-category's pov from lib/categories.ts on public pages when
            left empty (the normal case). Use this to write a per-collection
            "How I Tested" when the standard category voice doesn't fit. */}
        <details className="group rounded-xl bg-surface-sunken/60 border border-soft">
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 min-h-[44px]">
            <div>
              <p className="text-sm font-semibold text-prose">Methodology override</p>
              <p className="text-xs text-prose-faint">
                Optional. Public pages fall back to the category&apos;s &quot;how I test&quot; voice when empty.
              </p>
            </div>
            <svg className="w-4 h-4 text-prose-faint group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-4 pb-4 pt-1 space-y-2 border-t border-soft">
            <label htmlFor="pf-methodology" className="block text-xs text-prose-muted mb-1.5">
              How I Tested <span className="text-prose-faint">(plain text — line breaks preserved)</span>
            </label>
            <textarea
              id="pf-methodology"
              value={methodologyHtml}
              onChange={(e) => setMethodologyHtml(e.target.value)}
              maxLength={10000}
              rows={6}
              placeholder="Tell the reader how the testing was done for this specific collection. Skipped categories, time windows, real-life conditions, etc."
              className="w-full px-3 py-2 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover text-sm resize-y"
            />
            <p className="text-xs text-prose-faint tabular-nums">{methodologyHtml.length}/10000</p>
          </div>
        </details>

        {/* FAQ override — collapsible. Falls back to the dominant
            item-category's faqs from lib/categories.ts on public pages when
            empty. Up to 12 rows; each is question + answer text. */}
        <details className="group rounded-xl bg-surface-sunken/60 border border-soft">
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 min-h-[44px]">
            <div>
              <p className="text-sm font-semibold text-prose">FAQ override</p>
              <p className="text-xs text-prose-faint">
                Optional. {faqs.length > 0 ? `${faqs.length} of 12 entries.` : 'Public pages fall back to the category FAQs when empty.'}
              </p>
            </div>
            <svg className="w-4 h-4 text-prose-faint group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-4 pb-4 pt-2 border-t border-soft space-y-3">
            {faqs.length === 0 && (
              <p className="text-xs text-prose-faint italic">
                No custom FAQs yet — readers will see the category&apos;s default Q&amp;A.
              </p>
            )}
            {faqs.map((faq, idx) => (
              <div key={idx} className="rounded-lg bg-surface border border-soft p-3 space-y-2 relative">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-eyebrow">Q&amp;A {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => setFaqs((f) => f.filter((_, i) => i !== idx))}
                    className="text-xs text-prose-faint hover:text-danger-ink transition-colors"
                    title="Remove this Q&A"
                  >
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => {
                    const v = e.target.value
                    setFaqs((f) => f.map((q, i) => i === idx ? { ...q, question: v } : q))
                  }}
                  maxLength={200}
                  placeholder="Question (e.g. How long did you test these?)"
                  className="w-full px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover text-sm"
                />
                <textarea
                  value={faq.answer}
                  onChange={(e) => {
                    const v = e.target.value
                    setFaqs((f) => f.map((q, i) => i === idx ? { ...q, answer: v } : q))
                  }}
                  maxLength={1000}
                  rows={3}
                  placeholder="Answer — concise and direct."
                  className="w-full px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover text-sm resize-y"
                />
              </div>
            ))}
            {faqs.length < 12 && (
              <button
                type="button"
                onClick={() => setFaqs((f) => [...f, { question: '', answer: '' }])}
                className="w-full px-3 py-2 bg-surface hover:bg-surface-raised border border-dashed border-strong hover:border-accent-border text-xs text-prose-muted hover:text-accent rounded-lg transition-colors min-h-[44px]"
              >
                + Add Q&amp;A
              </button>
            )}
          </div>
        </details>

        {/* Readiness — quick visual checklist of what's set vs missing */}
        <div className="bg-surface-sunken/60 border border-soft rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-xs text-prose-muted font-semibold uppercase tracking-widest">Ready to publish?</p>
            <p className={`text-xs font-bold tabular-nums ${requiredMissing > 0 ? 'text-warn-ink' : 'text-forest'}`}>
              {requiredMissing > 0 ? `${requiredMissing} required missing` : 'All required ✓'}
            </p>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {readiness.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-xs">
                <span
                  aria-hidden
                  className={`w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black ${
                    c.done
                      ? 'bg-success-bg0/20 text-forest'
                      : c.required
                      ? 'bg-warn-bg0/20 text-warn-ink'
                      : 'bg-surface-raised text-prose-faint'
                  }`}
                >
                  {c.done ? '✓' : c.required ? '!' : '·'}
                </span>
                <span className={c.done ? 'text-prose-muted' : c.required ? 'text-warn-ink' : 'text-prose-faint'}>
                  {c.label}{c.required && !c.done ? ' (required)' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {isNew && (
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input
              type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)}
              className="w-4 h-4 rounded accent-orange-500"
            />
            <span className="text-sm text-prose-muted">Publish (make visible on site)</span>
          </label>
        )}
      </div>

      {/* Items */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-prose">
              Picks <span className="text-prose-faint font-normal">({items.length})</span>
            </p>
            {(() => {
              const range = priceRangeSummary(items)
              if (items.length === 0) return null
              if (range) {
                const fmt = (c: number) => `$${(c / 100).toFixed(0)}`
                const label = range.min === range.max ? fmt(range.min) : `${fmt(range.min)} – ${fmt(range.max)}`
                return (
                  <p className="text-xs text-prose-faint mt-0.5 tabular-nums">
                    Price range: <span className="text-accent-text-soft font-semibold">{label}</span>
                    {range.priced < range.total && (
                      <span className="text-warn-ink/80 ml-2">({range.total - range.priced} unpriced)</span>
                    )}
                  </p>
                )
              }
              return <p className="text-xs text-warn-ink/80 mt-0.5">No items have a product price — readers won&apos;t see a price.</p>
            })()}
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={callFillAI}
              disabled={fillBusy}
              className="text-xs px-3 py-2 bg-accent/40 hover:bg-accent/60 disabled:opacity-40 text-orange-200 font-semibold rounded-lg transition-colors min-h-[36px]"
              title="Generate per-pick blurbs, role labels, and flavor-specific FAQs in one shot"
            >
              {fillBusy ? '✨ Filling…' : '✨ Fill blurbs, roles & FAQs'}
            </button>
          )}
        </div>
        {fillError && (
          <p className="mb-3 text-xs text-danger-ink bg-danger-bg border border-danger-line rounded-lg px-3 py-2">{fillError}</p>
        )}
        {fillNote && !fillError && (
          <p className="mb-3 text-xs text-forest bg-success-bg border border-success-line rounded-lg px-3 py-2">{fillNote}</p>
        )}

        {/* Search to add */}
        <div className="relative mb-4">
          <input
            type="text" value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); searchReviews(e.target.value) }}
            placeholder="Search approved reviews to add..."
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover text-base"
          />
          {(searchResults.length > 0 || searching) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-sunken border border-soft rounded-xl shadow-2xl z-10 overflow-hidden">
              {searching && <p className="text-xs text-prose-faint px-4 py-3">Searching...</p>}
              {searchResults.map((r) => (
                <button
                  key={r.id} type="button" onClick={() => addItem(r)}
                  disabled={items.some((i) => i.review_id === r.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors text-left disabled:opacity-40"
                >
                  {r.image_url && (
                    <div className="relative w-8 h-8 rounded shrink-0 bg-surface-raised overflow-hidden">
                      <Image src={r.image_url} alt={r.product_name} fill className="object-cover" sizes="32px" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-prose truncate">{r.title}</p>
                    <p className="text-xs text-prose-faint">{r.product_name} · {r.rating}/10</p>
                  </div>
                  {items.some((i) => i.review_id === r.id) && <span className="text-xs text-forest ml-auto shrink-0">Added</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items list */}
        {items.length === 0 ? (
          <p className="text-sm text-prose-faint py-4 text-center">No picks yet — search for reviews above.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => {
              const review = getReview(item)
              return (
                <div key={item.review_id} className="bg-surface border border-soft rounded-xl p-3">
                  <div className="flex items-start gap-3">
                    {review?.image_url && (
                      <div className="relative w-12 h-12 shrink-0 rounded-lg bg-surface-raised overflow-hidden">
                        <Image src={review.image_url} alt={review.product_name} fill className="object-contain p-1" sizes="48px" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-prose leading-tight">{review?.title ?? item.review_id}</p>
                      <p className="text-xs text-prose-faint mt-0.5">{review?.product_name} · {review?.rating}/10</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-base text-prose-faint hover:text-prose disabled:opacity-30 transition-colors rounded-lg hover:bg-surface-raised" title="Move up" aria-label="Move up">↑</button>
                      <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-base text-prose-faint hover:text-prose disabled:opacity-30 transition-colors rounded-lg hover:bg-surface-raised" title="Move down" aria-label="Move down">↓</button>
                      <button type="button" onClick={() => removeItem(item.review_id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-lg text-prose-faint hover:text-danger-ink hover:bg-danger-bg transition-colors rounded-lg" title="Remove" aria-label="Remove">×</button>
                    </div>
                  </div>
                  <textarea
                    value={item.blurb ?? ''}
                    onChange={(e) => updateBlurb(item.review_id, e.target.value)}
                    placeholder="Optional editorial blurb for this pick (2-3 sentences)..."
                    rows={2}
                    className="mt-2 w-full px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover resize-none text-base sm:text-sm"
                  />
                  {pickType === 'comparison' && (
                    <input
                      type="text"
                      value={item.wins_category ?? ''}
                      onChange={(e) => updateWinsCategory(item.review_id, e.target.value)}
                      placeholder="Winner badge (e.g. 'Best Overall', 'Best Budget', 'Best for Solo Use')"
                      maxLength={80}
                      className="mt-2 w-full px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover text-base sm:text-sm"
                    />
                  )}
                  {/* Role label — every non-comparison flavor renders this as
                      the chip above the product name on public pages. Comparison
                      uses wins_category instead (winner-per-criterion). */}
                  {(() => {
                    const cfg = ROLE_LABEL_CONFIG[pickType]
                    if (!cfg) return null
                    return (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={item.role_label ?? ''}
                          onChange={(e) => updateRoleLabel(item.review_id, e.target.value)}
                          placeholder={cfg.placeholder}
                          maxLength={80}
                          aria-label={cfg.label}
                          className="w-full px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover text-base sm:text-sm"
                        />
                      </div>
                    )
                  })()}
                  {/* "Best for" tagline — optional italic line shown beneath the
                      title on every flavor. Comparison + best-of/general lean
                      on it the most, but it can sharpen a gift-guide pick
                      ("Best for the dad on shift work") so we surface it
                      everywhere except stack (where role_label already plays
                      this part). */}
                  {pickType !== 'stack' && (
                    <input
                      type="text"
                      value={item.best_for ?? ''}
                      onChange={(e) => updateBestFor(item.review_id, e.target.value)}
                      placeholder="Best for… (e.g. 'the grill master', 'weekend warriors')"
                      maxLength={120}
                      className="mt-2 w-full px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover text-base sm:text-sm"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {error && <p className="text-danger-ink text-sm bg-danger-bg border border-danger-line rounded-lg px-4 py-3">{error}</p>}

      {/* Sticky action bar — pins to the bottom of the viewport so Save /
          Publish / View Live / Delete are reachable from anywhere in this
          long form, especially on mobile. Matches the VoiceProfileForm
          pattern. */}
      <div className="sticky bottom-2 sm:bottom-4 z-20 mt-4 -mx-3 sm:mx-0 px-3 sm:px-4 py-3 bg-surface-sunken/85 backdrop-blur border border-soft rounded-xl shadow-lg shadow-black/5">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button type="submit" disabled={busy || !slug.trim() || !title.trim()}
            className="px-4 sm:px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors min-h-[44px]">
            {busy ? 'Saving…' : isNew ? 'Create List' : 'Save Changes'}
          </button>

          {!isNew && (
            <button type="button"
              onClick={() => handleSave(null, { visible: !visible })}
              disabled={busy || !slug.trim() || !title.trim()}
              className={visible
                ? 'px-4 sm:px-5 py-2.5 bg-warn-bg hover:bg-warn-bg border border-warn-line text-warn-ink text-sm font-semibold rounded-xl transition-colors min-h-[44px] disabled:opacity-40'
                : 'px-4 sm:px-5 py-2.5 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors min-h-[44px] disabled:opacity-40'}>
              {busy ? '…' : visible ? 'Unpublish' : 'Publish Live'}
            </button>
          )}

          {!isNew && visible && publicPath && (
            <a href={publicPath} target="_blank" rel="noopener noreferrer"
               className="px-4 sm:px-5 py-2.5 bg-accent-tint hover:bg-accent-tint border border-accent-border/40 text-accent-text-soft hover:text-accent text-sm font-semibold rounded-xl transition-colors min-h-[44px] inline-flex items-center gap-1.5">
              View Live →
            </a>
          )}

          {!isNew && (
            <button type="button" onClick={handleDelete} disabled={deleting}
              className="ml-auto px-4 sm:px-5 py-2.5 text-danger-ink hover:text-danger-ink text-sm transition-colors disabled:opacity-40 min-h-[44px]">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>

        {/* Status line under the buttons — keeps the bar compact on mobile
            and avoids the long URL pushing buttons off the row. */}
        {(savedAt || (!isNew && !visible && publicPath)) && !busy && !error && (
          <div className="mt-2 text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
            {savedAt && (
              <span className="text-forest font-semibold">Saved at {savedAt}</span>
            )}
            {!isNew && !visible && publicPath && (
              <span className="text-prose-faint">
                Hidden — will live at <code className="text-accent-text-soft/70">{publicPath}</code>
              </span>
            )}
          </div>
        )}
      </div>
    </form>
  )
}
