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
}

interface PickItem {
  id?: string
  review_id: string
  position: number
  blurb: string | null
  wins_category?: string | null
  role_label?: string | null
  reviews?: ReviewSummary | ReviewSummary[] | null
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
}

interface Props {
  pick: PickList | null
  initialItems: PickItem[]
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setSavedAt(null)

    const parsedBundleTotal = bundleTotalCents.trim() ? parseInt(bundleTotalCents.trim(), 10) : null

    const payload = {
      slug: slug.trim().toLowerCase(),
      title: title.trim(),
      description: description.trim() || null,
      intro_html: introHtml.trim() || null,
      hero_image_url: heroUrl.trim() || null,
      is_visible: visible,
      collection_type: pickType,
      occasion: pickType === 'gift_guide' ? (occasion || null) : null,
      winner_summary: pickType === 'comparison' ? (winnerSummary.trim() || null) : null,
      bundle_total_cents: pickType === 'stack' && parsedBundleTotal !== null && !isNaN(parsedBundleTotal) ? parsedBundleTotal : null,
      meta_title:           metaTitle.trim() || null,
      meta_description:     metaDescription.trim() || null,
      scheduled_publish_at: scheduledAt,
      items: items.map((i) => ({
        review_id:     i.review_id,
        position:      i.position,
        blurb:         i.blurb,
        wins_category: pickType === 'comparison' ? (i.wins_category ?? null) : null,
        role_label:    pickType === 'stack' ? (i.role_label ?? null) : null,
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
          <label className="block text-sm text-gray-300 mb-1.5">Slug <span className="text-red-400">*</span></label>
          <input
            type="text" required value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())}
            pattern="[a-z0-9-]+" placeholder="fathers-day-gift-guide"
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
          />
          <p className="mt-1 text-xs text-gray-600">
            Public URL: {pickType === 'comparison'
              ? `/comparisons/${slug || 'your-slug'}`
              : pickType === 'stack'
              ? `/stacks/${slug || 'your-slug'}`
              : pickType === 'gift_guide'
              ? `/gifts/${slug || 'your-slug'}`
              : `/picks/${slug || 'your-slug'}`}
          </p>
          {slugTaken && (
            <p className="mt-1 text-xs text-amber-400">
              ⚠ Slug already in use by an existing <strong className="font-semibold">{slugTaken.type === 'gift_guide' ? 'gift guide' : slugTaken.type === 'best_of' ? 'best-of list' : slugTaken.type}</strong>. Saving will fail until you pick a different one.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Title <span className="text-red-400">*</span></label>
          <input
            type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Father's Day Gift Guide 2026"
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Short description <span className="text-gray-600">(shows on index cards)</span></label>
          <input
            type="text" value={description} onChange={(e) => setDesc(e.target.value)}
            placeholder="Dad-tested picks that actually earn a spot in the garage or kitchen."
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
          />
        </div>

        <div>
          <div className="flex items-end justify-between mb-1.5 gap-2 flex-wrap">
            <label className="block text-sm text-gray-300">
              Editorial intro <span className="text-gray-600">(shows above the body of the detail page)</span>
            </label>
            <button
              type="button"
              onClick={() => callIntroAI(false)}
              disabled={aiBusy || items.length < 2}
              className="text-xs px-3 py-1.5 bg-orange-700/60 hover:bg-orange-600/60 disabled:opacity-40 text-orange-200 font-semibold rounded-lg transition-colors min-h-[32px]"
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
                className="flex-1 px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              />
              <button
                type="button"
                onClick={() => callIntroAI(true)}
                disabled={aiBusy || !refineInstruction.trim() || items.length < 2}
                className="shrink-0 text-xs px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 font-semibold rounded-lg transition-colors min-h-[36px]"
              >
                {aiBusy && refineInstruction ? 'Refining…' : 'Refine →'}
              </button>
            </div>
          )}

          {aiError && (
            <p className="mt-2 text-xs text-red-400 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">{aiError}</p>
          )}

          {/* Inline images — manages bd-image-placeholder figures inside the intro */}
          <div className="mt-3 bg-gray-950/60 border border-gray-800/60 rounded-xl p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-3">Inline images</p>
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
        <p className="-mt-3 text-xs text-gray-600">
          📷 Take a real photo, 📁 pick from the media library, or generate an editorial scene with AI.
        </p>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Collection type</label>
          <select
            value={pickType} onChange={(e) => setPickType(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
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
            <label className="block text-sm text-gray-300 mb-1.5">
              Bottom line <span className="text-gray-600">(one-line verdict shown above the scorecard)</span>
            </label>
            <textarea
              value={winnerSummary}
              onChange={(e) => setWinnerSummary(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Buy the Yeti for everyday use, the RTIC if you need it bigger, and skip the Igloo unless you're on a budget."
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-base"
            />
            <p className="mt-1 text-xs text-gray-600">{winnerSummary.length}/500</p>
          </div>
        )}

        {pickType === 'stack' && (
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">
              Bundle total <span className="text-gray-600">(cents — optional; otherwise computed from items)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={bundleTotalCents}
              onChange={(e) => setBundleTotal(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 49999 = $499.99"
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
            />
            {bundleTotalCents && !isNaN(parseInt(bundleTotalCents, 10)) && (
              <p className="mt-1 text-xs text-orange-400">${(parseInt(bundleTotalCents, 10) / 100).toFixed(2)}</p>
            )}
          </div>
        )}

        {pickType === 'gift_guide' && (
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Occasion <span className="text-red-400">*</span></label>
            <select
              value={occasion} onChange={(e) => setOccasion(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
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
            <p className="mt-1 text-xs text-gray-600">
              This list will replace any previous gift guide for this occasion at <code className="text-orange-400">/gifts/{OCCASIONS.find((o) => o.value === occasion)?.slug ?? '[occasion]'}</code>
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
          <p className="-mt-3 text-xs text-amber-400">
            ⚠ This collection is already live. Clear the schedule, or unpublish first to schedule a future drop.
          </p>
        )}

        {/* SEO overrides — collapsible since they're optional */}
        <details className="group rounded-xl bg-gray-950/60 border border-gray-800/60">
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 min-h-[44px]">
            <div>
              <p className="text-sm font-semibold text-gray-200">SEO overrides</p>
              <p className="text-xs text-gray-600">Optional. Fall back to title + description if left empty.</p>
            </div>
            <svg className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-800/60">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Meta title <span className="text-gray-600">(HTML &lt;title&gt; tag; ~70 char limit)</span>
              </label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                maxLength={120}
                placeholder={title ? `${title.slice(0, 60)}${title.length > 60 ? '…' : ''}` : 'Defaults to title'}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              />
              <p className="mt-1 text-xs text-gray-600 tabular-nums">{metaTitle.length}/120</p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Meta description <span className="text-gray-600">(search snippet; ~155 char limit)</span>
              </label>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDesc(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder={description || 'Defaults to short description'}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm resize-none"
              />
              <p className="mt-1 text-xs text-gray-600 tabular-nums">{metaDescription.length}/300</p>
            </div>
          </div>
        </details>

        {/* Readiness — quick visual checklist of what's set vs missing */}
        <div className="bg-gray-950/60 border border-gray-800/60 rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Ready to publish?</p>
            <p className={`text-xs font-bold tabular-nums ${requiredMissing > 0 ? 'text-amber-400' : 'text-green-400'}`}>
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
                      ? 'bg-green-500/20 text-green-400'
                      : c.required
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-gray-800 text-gray-600'
                  }`}
                >
                  {c.done ? '✓' : c.required ? '!' : '·'}
                </span>
                <span className={c.done ? 'text-gray-300' : c.required ? 'text-amber-300' : 'text-gray-500'}>
                  {c.label}{c.required && !c.done ? ' (required)' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <label className="flex items-center gap-3 cursor-pointer py-1">
          <input
            type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)}
            className="w-4 h-4 rounded accent-orange-500"
          />
          <span className="text-sm text-gray-300">Publish (make visible on site)</span>
        </label>
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Picks <span className="text-gray-500 font-normal">({items.length})</span></p>
        </div>

        {/* Search to add */}
        <div className="relative mb-4">
          <input
            type="text" value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); searchReviews(e.target.value) }}
            placeholder="Search approved reviews to add..."
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
          />
          {(searchResults.length > 0 || searching) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-950 border border-gray-800 rounded-xl shadow-2xl z-10 overflow-hidden">
              {searching && <p className="text-xs text-gray-500 px-4 py-3">Searching...</p>}
              {searchResults.map((r) => (
                <button
                  key={r.id} type="button" onClick={() => addItem(r)}
                  disabled={items.some((i) => i.review_id === r.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-900 transition-colors text-left disabled:opacity-40"
                >
                  {r.image_url && (
                    <div className="relative w-8 h-8 rounded shrink-0 bg-gray-800 overflow-hidden">
                      <Image src={r.image_url} alt={r.product_name} fill className="object-cover" sizes="32px" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{r.title}</p>
                    <p className="text-xs text-gray-500">{r.product_name} · {r.rating}/10</p>
                  </div>
                  {items.some((i) => i.review_id === r.id) && <span className="text-xs text-green-400 ml-auto shrink-0">Added</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items list */}
        {items.length === 0 ? (
          <p className="text-sm text-gray-600 py-4 text-center">No picks yet — search for reviews above.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => {
              const review = getReview(item)
              return (
                <div key={item.review_id} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                  <div className="flex items-start gap-3">
                    {review?.image_url && (
                      <div className="relative w-12 h-12 shrink-0 rounded-lg bg-gray-800 overflow-hidden">
                        <Image src={review.image_url} alt={review.product_name} fill className="object-contain p-1" sizes="48px" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight">{review?.title ?? item.review_id}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{review?.product_name} · {review?.rating}/10</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-base text-gray-500 hover:text-white disabled:opacity-30 transition-colors rounded-lg hover:bg-gray-800" title="Move up" aria-label="Move up">↑</button>
                      <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-base text-gray-500 hover:text-white disabled:opacity-30 transition-colors rounded-lg hover:bg-gray-800" title="Move down" aria-label="Move down">↓</button>
                      <button type="button" onClick={() => removeItem(item.review_id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-lg text-gray-600 hover:text-red-400 hover:bg-red-950/30 transition-colors rounded-lg" title="Remove" aria-label="Remove">×</button>
                    </div>
                  </div>
                  <textarea
                    value={item.blurb ?? ''}
                    onChange={(e) => updateBlurb(item.review_id, e.target.value)}
                    placeholder="Optional editorial blurb for this pick (2-3 sentences)..."
                    rows={2}
                    className="mt-2 w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none text-base sm:text-sm"
                  />
                  {pickType === 'comparison' && (
                    <input
                      type="text"
                      value={item.wins_category ?? ''}
                      onChange={(e) => updateWinsCategory(item.review_id, e.target.value)}
                      placeholder="Winner badge (e.g. 'Best Overall', 'Best Budget', 'Best for Solo Use')"
                      maxLength={80}
                      className="mt-2 w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 text-base sm:text-sm"
                    />
                  )}
                  {pickType === 'stack' && (
                    <input
                      type="text"
                      value={item.role_label ?? ''}
                      onChange={(e) => updateRoleLabel(item.review_id, e.target.value)}
                      placeholder="Role in the stack (e.g. 'The Anchor', 'The Daily Driver', 'The Backup')"
                      maxLength={80}
                      className="mt-2 w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 text-base sm:text-sm"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">{error}</p>}

      <div className="flex items-center gap-3 pt-2 flex-wrap">
        <button type="submit" disabled={busy || !slug.trim() || !title.trim()}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors min-h-[44px]">
          {busy ? 'Saving…' : isNew ? 'Create List' : 'Save Changes'}
        </button>
        {!isNew && (
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="px-5 py-2.5 text-red-400 hover:text-red-300 text-sm transition-colors disabled:opacity-40 min-h-[44px]">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
        {!busy && !error && savedAt && (
          <span className="text-sm text-green-400 font-semibold">
            Saved at {savedAt}
          </span>
        )}
      </div>
    </form>
  )
}
