'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'
import { TESTING_DURATION_OPTIONS } from '@/lib/products'
import type { ProductSpec } from '@/lib/products'

const STORAGE_KEY = 'bd:review-wizard-draft'

type Step = 'idea' | 'generating' | 'preview' | 'saving'

interface ProductOption {
  id: string
  slug: string
  name: string
  brand: string | null
  specs: ProductSpec[]
  category: string | null
  store: string
  affiliate_url: string | null
  non_affiliate_url: string | null
  price_cents: number | null
}

export function ReviewCreateWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idea')
  const [error, setError] = useState<string | null>(null)

  const [description, setDescription]   = useState('')
  const [productName, setProductName]   = useState('')
  const [productSlug, setProductSlug]   = useState('')
  const [keyFeatures, setKeyFeatures]   = useState('')
  const [category, setCategory]         = useState('')
  const [comparisonSlugs, setComparisonSlugs] = useState<string[]>([])
  const [imageSlots, setImageSlots]     = useState<number | 'auto'>('auto')
  const [suggesting, setSuggesting]     = useState(false)
  const [suggestions, setSuggestions]   = useState<{ productName: string; angle: string; keyFeatures: string[] }[]>([])

  // Your Experience fields — drive Claude's tone and persist to the review row
  const [inputRating, setInputRating]       = useState<number | null>(null)
  const [testingDuration, setTestingDuration] = useState('')
  const [howYouUsedIt, setHowYouUsedIt]     = useState('')
  const [standoutMoment, setStandoutMoment] = useState('')
  const [pricePaid, setPricePaid]           = useState('')

  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved.description)            setDescription(saved.description)
      if (saved.productName)            setProductName(saved.productName)
      if (saved.productSlug)            setProductSlug(saved.productSlug)
      if (saved.keyFeatures)            setKeyFeatures(saved.keyFeatures)
      if (saved.category)               setCategory(saved.category)
      if (Array.isArray(saved.comparisonSlugs)) setComparisonSlugs(saved.comparisonSlugs)
      if (saved.imageSlots !== undefined) setImageSlots(saved.imageSlots)
      if (saved.inputRating != null)    setInputRating(saved.inputRating)
      if (saved.testingDuration)        setTestingDuration(saved.testingDuration)
      if (saved.howYouUsedIt)           setHowYouUsedIt(saved.howYouUsedIt)
      if (saved.standoutMoment)         setStandoutMoment(saved.standoutMoment)
      if (saved.pricePaid)              setPricePaid(saved.pricePaid)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ description, productName, productSlug, keyFeatures, category, comparisonSlugs, imageSlots, inputRating, testingDuration, howYouUsedIt, standoutMoment, pricePaid }))
    } catch { /* ignore */ }
  }, [description, productName, productSlug, keyFeatures, category, comparisonSlugs, imageSlots, inputRating, testingDuration, howYouUsedIt, standoutMoment, pricePaid])

  const [previewDraft, setPreviewDraft] = useState<{
    title: string; excerpt: string; content: string
    rating: number; pros: string[]; cons: string[]; imagePrompt: string
    tldr: string; keyTakeaways: string[]; bestFor: string[]; notFor: string[]
    faqs: { question: string; answer: string }[]
    suggestedTags: string[]
    subScores: { quality: number | null; value: number | null; ease: number | null; dailyUse: number | null }
    wouldRebuy: boolean | null
  } | null>(null)

  const [products, setProducts]         = useState<ProductOption[]>([])
  const [productsLoaded, setProductsLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/products')
      .then((r) => r.json())
      .then((json) => { if (!cancelled) setProducts(json.products ?? []) })
      .catch(() => { /* silent — user can still enter a review without picking */ })
      .finally(() => { if (!cancelled) setProductsLoaded(true) })
    return () => { cancelled = true }
  }, [])

  function handlePickProduct(slug: string) {
    setProductSlug(slug)
    if (!slug) return
    const match = products.find((p) => p.slug === slug)
    if (match) {
      setProductName(match.name)
      // Auto-fill price only if the field is still empty (don't clobber typed values)
      if (!pricePaid.trim() && match.price_cents != null) {
        setPricePaid(String(match.price_cents))
      }
      // Seed the category from the catalog product (only if unset) — this also
      // unlocks the competitor picker, which is gated on a chosen category.
      if (!category && match.category) {
        setCategory(match.category)
      }
    }
  }

  // Competitor picker — any other product in the same category (different brand
  // OR a different model of the same brand, e.g. a 20V vs 60V tool). Requires a
  // category; excludes only the product being reviewed.
  const competitorOptions = category
    ? products.filter((p) => p.category === category && p.slug !== productSlug.trim())
    : []
  const selectedCompetitors = competitorOptions.filter((p) => comparisonSlugs.includes(p.slug))
  const MAX_COMPETITORS = 4

  function toggleCompetitor(slug: string) {
    setComparisonSlugs((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= MAX_COMPETITORS ? prev : [...prev, slug],
    )
  }

  function specCount(p: ProductOption): number {
    return (Array.isArray(p.specs) ? p.specs : []).filter((s) => s.label?.trim() && s.value?.trim()).length
  }

  async function handleSuggest() {
    if (!description.trim()) { setError('Describe your idea first'); return }
    setSuggesting(true); setError(null)
    try {
      const res = await fetch('/api/claude/suggest-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, type: 'review' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Suggest failed')
      if (json.suggestions?.length) {
        setSuggestions(json.suggestions)
      } else {
        if (json.productName) setProductName(json.productName)
        if (json.keyFeatures?.length) setKeyFeatures(json.keyFeatures.join('\n'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suggest failed')
    }
    setSuggesting(false)
  }

  function pickSuggestion(s: { productName: string; keyFeatures: string[] }) {
    setProductName(s.productName)
    setKeyFeatures(s.keyFeatures.join('\n'))
    setSuggestions([])
  }

  async function handleGenerate() {
    if (!productName.trim()) { setError('Enter a product name first'); return }
    if (!category) { setError('Select a category before generating'); return }
    if (inputRating === null) { setError('Rate the product before generating — this drives the draft tone'); return }
    setStep('generating'); setError(null)

    const parsedPricePaid = pricePaid.trim() ? parseInt(pricePaid.trim(), 10) : null

    try {
      // If a catalog product is linked, pull its brand + specs to ground the
      // draft. Inside try so a malformed specs value can't strand the spinner.
      const linked = productSlug.trim() ? products.find((p) => p.slug === productSlug.trim()) : undefined
      const rawSpecs = linked?.specs
      const linkedSpecs = (Array.isArray(rawSpecs) ? rawSpecs : []).filter((s) => s.label?.trim() && s.value?.trim())

      // Selected competitors → name/brand/specs for honest head-to-head prose.
      const competitorPayload = selectedCompetitors.map((c) => ({
        name: c.name,
        ...(c.brand?.trim() ? { brand: c.brand.trim() } : {}),
        specs: (Array.isArray(c.specs) ? c.specs : []).filter((s) => s.label?.trim() && s.value?.trim()),
      }))

      const genRes = await fetch('/api/claude/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          category,
          keyFeatures: keyFeatures.split('\n').map(f => f.trim()).filter(Boolean),
          imageSlots,
          ratingHint: inputRating,
          ...(productSlug.trim() ? { productSlug: productSlug.trim() } : {}),
          ...(linked?.brand?.trim() ? { brand: linked.brand.trim() } : {}),
          ...(linkedSpecs.length ? { specs: linkedSpecs } : {}),
          ...(competitorPayload.length ? { competitors: competitorPayload } : {}),
          ...(testingDuration ? { testingDuration } : {}),
          ...(howYouUsedIt.trim() ? { howYouUsedIt: howYouUsedIt.trim() } : {}),
          ...(standoutMoment.trim() ? { standoutMoment: standoutMoment.trim() } : {}),
          ...(!isNaN(parsedPricePaid!) && parsedPricePaid !== null ? { pricePaid: parsedPricePaid } : {}),
        }),
      })
      const genJson = await genRes.json()
      if (!genRes.ok) {
        const { fieldErrors, formErrors } = genJson.details ?? {}
        const parts = [
          ...(formErrors ?? []),
          ...Object.entries(fieldErrors ?? {}).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`),
        ]
        throw new Error(parts.length ? `${genJson.error} — ${parts.join('; ')}` : (genJson.error ?? 'Generation failed'))
      }

      const draft = genJson.draft as {
        title: string; excerpt: string; introduction: string
        sections: { heading: string; body: string }[]
        verdict: string; pros: string[]; cons: string[]
        inlineImages?: { afterHeading: string; prompt: string; altText: string; caption: string }[]
      }

      const slots = (draft.inlineImages ?? []).map((img, i) => ({ ...img, slotId: `slot-${i + 1}` }))

      function escAttr(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      }
      function placeholderFor(slot: typeof slots[number]): string {
        return `<figure class="bd-image-placeholder" data-slot-id="${slot.slotId}" data-prompt="${escAttr(slot.prompt)}" data-alt="${escAttr(slot.altText)}" data-caption="${escAttr(slot.caption)}"><figcaption>🖼 Suggested: ${escAttr(slot.caption || slot.altText)}</figcaption></figure>`
      }

      const content = [
        draft.introduction,
        ...(draft.sections ?? []).map((s) => {
          const bodyHtml = s.body.split(/\n\n+/).map((p) => `<p>${p.trim()}</p>`).join('\n')
          const matched = slots.filter((sl) => sl.afterHeading.trim().toLowerCase() === s.heading.trim().toLowerCase())
          const imgs = matched.map(placeholderFor).join('\n')
          return `<h2>${s.heading}</h2>\n${bodyHtml}${imgs ? `\n${imgs}` : ''}`
        }),
        draft.verdict ? `<h2>The Verdict</h2>\n<p>${draft.verdict}</p>` : '',
      ].filter(Boolean).join('\n\n')

      const d = draft as Record<string, unknown>
      const sub = (d.subScores ?? {}) as Record<string, unknown>
      const subScores = {
        quality:  typeof sub.quality  === 'number' ? sub.quality  : null,
        value:    typeof sub.value    === 'number' ? sub.value    : null,
        ease:     typeof sub.ease     === 'number' ? sub.ease     : null,
        dailyUse: typeof sub.dailyUse === 'number' ? sub.dailyUse : null,
      }
      const wouldRebuy = typeof d.wouldRebuy === 'boolean' ? d.wouldRebuy : null

      setPreviewDraft({
        title: draft.title, excerpt: draft.excerpt, content,
        rating: inputRating!,  // use our input — Claude's rating is ignored
        pros: draft.pros ?? [], cons: draft.cons ?? [],
        imagePrompt: genJson.imagePrompt ?? '',
        tldr: d.tldr as string ?? '',
        keyTakeaways: d.keyTakeaways as string[] ?? [],
        bestFor: d.bestFor as string[] ?? [],
        notFor: d.notFor as string[] ?? [],
        faqs: d.faqs as { question: string; answer: string }[] ?? [],
        suggestedTags: Array.isArray(genJson.suggestedTags) ? genJson.suggestedTags : [],
        subScores,
        wouldRebuy,
      })
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setStep('idea')
    }
  }

  async function handleSaveDraft() {
    if (!previewDraft) return
    setStep('saving'); setError(null)
    try {
      const saveRes = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: previewDraft.title,
          product_name: productName,
          category,
          excerpt: previewDraft.excerpt,
          content: previewDraft.content,
          image_url: null,
          pros: previewDraft.pros,
          cons: previewDraft.cons,
          product_slug: productSlug.trim() || null,
          disclosure_acknowledged: false,
          tldr: previewDraft.tldr,
          key_takeaways: previewDraft.keyTakeaways,
          best_for: previewDraft.bestFor,
          not_for: previewDraft.notFor,
          faqs: previewDraft.faqs,
          comparison_product_slugs: selectedCompetitors.map((c) => c.slug),
          testing_duration: testingDuration || null,
          how_you_used_it: howYouUsedIt.trim() || null,
          standout_moment: standoutMoment.trim() || null,
          price_paid_cents: pricePaid.trim() && !isNaN(parseInt(pricePaid, 10)) ? parseInt(pricePaid, 10) : null,
          score_quality:   previewDraft.subScores.quality,
          score_value:     previewDraft.subScores.value,
          score_ease:      previewDraft.subScores.ease,
          score_daily_use: previewDraft.subScores.dailyUse,
          would_rebuy:     previewDraft.wouldRebuy,
          suggested_tags: previewDraft.suggestedTags,
        }),
      })
      const saveJson = await saveRes.json()
      if (!saveJson) throw new Error('Save failed')
      if (!saveRes.ok) throw new Error(saveJson.error ?? 'Save failed')
      sessionStorage.setItem(`bd:hero-prompt:${saveJson.review.id}`, previewDraft.imagePrompt)
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
      router.push(`/dashboard/reviews/${saveJson.review.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setStep('preview')
    }
  }

  async function handleSkipToBlank() {
    if (!productName.trim()) { setError('Enter a product name first'); return }
    if (inputRating === null) { setError('Rate the product before continuing'); return }
    setStep('saving'); setError(null)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${productName} Review`,
          product_name: productName,
          category,
          excerpt: '',
          content: '<p>Start writing here…</p>',
          image_url: null,
          score_quality:   inputRating,
          score_value:     inputRating,
          score_ease:      inputRating,
          score_daily_use: inputRating,
          pros: [],
          cons: [],
          product_slug: productSlug.trim() || null,
          comparison_product_slugs: selectedCompetitors.map((c) => c.slug),
          disclosure_acknowledged: false,
          testing_duration: testingDuration || null,
          how_you_used_it: howYouUsedIt.trim() || null,
          standout_moment: standoutMoment.trim() || null,
          price_paid_cents: pricePaid.trim() && !isNaN(parseInt(pricePaid, 10)) ? parseInt(pricePaid, 10) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      router.push(`/dashboard/reviews/${json.review.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
      setStep('idea')
    }
  }

  if (step === 'generating' || step === 'saving') {
    const label = step === 'generating' ? '✍️ Writing full review with Claude…' : '💾 Saving draft…'
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-8 h-8 border-4 border-soft border-t-orange-500 rounded-full animate-spin" />
        <p className="text-prose-muted font-medium">{label}</p>
        <p className="text-xs text-prose-faint">This can take up to 2 minutes</p>
      </div>
    )
  }

  if (step === 'preview' && previewDraft) {
    const plainText = previewDraft.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const preview = plainText.length > 500 ? plainText.slice(0, 500) + '…' : plainText
    return (
      <div className="space-y-5">
        <div className="bg-surface border border-strong rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold flex-1">Draft preview</p>
            <span className="text-sm font-bold text-warn-ink">{previewDraft.rating}/10</span>
          </div>
          <h2 className="text-lg font-black text-prose leading-snug">{previewDraft.title}</h2>
          {previewDraft.excerpt && (
            <p className="text-sm text-prose-muted italic">{previewDraft.excerpt}</p>
          )}
          <p className="text-sm text-prose-muted leading-relaxed">{preview}</p>
          {previewDraft.pros.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <p className="text-xs text-green-500 font-semibold mb-1">Pros</p>
                <ul className="space-y-0.5">
                  {previewDraft.pros.map((p, i) => <li key={i} className="text-xs text-prose-muted">+ {p}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-xs text-danger-ink font-semibold mb-1">Cons</p>
                <ul className="space-y-0.5">
                  {previewDraft.cons.map((c, i) => <li key={i} className="text-xs text-prose-muted">- {c}</li>)}
                </ul>
              </div>
            </div>
          )}
          {/* Sub-scores + re-buy — surface what Claude proposed so authors can review before saving */}
          {(previewDraft.subScores.quality != null || previewDraft.wouldRebuy != null) && (
            <p className="pt-2 text-[11px] text-prose-faint border-t border-soft">
              <span className="text-accent-text-soft font-semibold">Sub-scores:</span>{' '}
              Q{previewDraft.subScores.quality ?? '—'} ·
              V{previewDraft.subScores.value ?? '—'} ·
              E{previewDraft.subScores.ease ?? '—'} ·
              D{previewDraft.subScores.dailyUse ?? '—'}
              {previewDraft.wouldRebuy != null && (
                <>
                  <span className="mx-2 text-prose-faint">|</span>
                  <span className="text-accent-text-soft font-semibold">Re-buy:</span>{' '}
                  {previewDraft.wouldRebuy ? 'Yes' : 'No'}
                </>
              )}
              <span className="block mt-1 text-prose-faint">All editable in the workspace after save.</span>
            </p>
          )}
        </div>
        {error && (
          <p className="text-danger-ink text-sm bg-danger-bg border border-danger-line rounded-lg px-4 py-3">{error}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors"
          >
            ✓ Save &amp; open editor
          </button>
          <button
            type="button"
            onClick={() => { setPreviewDraft(null); setStep('generating'); handleGenerate() }}
            className="px-5 py-2.5 bg-surface-raised hover:bg-surface text-prose-muted text-sm rounded-xl transition-colors"
          >
            ↺ Regenerate
          </button>
          <button
            type="button"
            onClick={() => { setPreviewDraft(null); setStep('idea') }}
            className="px-5 py-2.5 text-prose-faint hover:text-prose text-sm transition-colors"
          >
            ← Edit inputs
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div className="bg-surface border border-accent-border/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-accent-text-soft">✨ Describe the product</p>
          <span className="text-xs text-prose-faint">Claude will suggest product name + key features</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 'review of the DeWalt 20V cordless drill I've been using for deck projects'"
            className="flex-1 px-4 py-2.5 bg-surface-sunken border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
            onKeyDown={(e) => { if (e.key === 'Enter' && !suggesting) handleSuggest() }}
          />
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggesting || !description.trim()}
            className="shrink-0 px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {suggesting ? 'Thinking…' : 'Suggest'}
          </button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-prose-faint">Pick an angle to fill the form — or dismiss to write your own:</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pickSuggestion(s)}
                className="text-left p-3 bg-surface-sunken border border-strong hover:border-accent/60 rounded-xl transition-colors group"
              >
                <p className="text-xs text-accent-text-soft font-medium mb-1 group-hover:text-accent">{s.angle}</p>
                <p className="text-sm text-prose font-semibold leading-snug mb-2">{s.productName}</p>
                <ul className="space-y-0.5">
                  {s.keyFeatures.slice(0, 3).map((kf, j) => (
                    <li key={j} className="text-xs text-prose-faint">· {kf}</li>
                  ))}
                  {s.keyFeatures.length > 3 && <li className="text-xs text-prose-faint">+{s.keyFeatures.length - 3} more</li>}
                </ul>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSuggestions([])}
            className="text-xs text-prose-faint hover:text-prose-muted transition-colors"
          >
            Dismiss — I&apos;ll write my own
          </button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Product name</label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="What product is this?"
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
          />
        </div>

        <div>
          <label className="block text-sm text-prose-muted mb-1.5">
            Affiliate product <span className="text-prose-faint">(optional — auto-embeds a [[BUY:slug]] link)</span>
          </label>
          <select
            value={productSlug}
            onChange={(e) => handlePickProduct(e.target.value)}
            disabled={!productsLoaded}
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover disabled:opacity-50"
          >
            <option value="">
              {productsLoaded ? '— None (no affiliate link) —' : 'Loading products…'}
            </option>
            {products.map((p) => {
              const tag = p.affiliate_url ? (p.store === 'amazon' ? 'Amazon' : 'Affiliate') : p.non_affiliate_url ? 'Link' : 'No URL'
              return (
                <option key={p.id} value={p.slug}>
                  {p.name} · {tag}
                </option>
              )
            })}
          </select>
          <p className="mt-1 text-xs text-prose-faint">
            Picking a product locks the product name to match and embeds one affiliate link in the draft. Manage the list at{' '}
            <Link href="/dashboard/admin/products" className="text-accent-text-soft hover:text-accent">/dashboard/admin/products</Link>.
          </p>
        </div>

        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Key features <span className="text-prose-faint">(one per line, optional)</span></label>
          <textarea
            value={keyFeatures}
            onChange={(e) => setKeyFeatures(e.target.value)}
            rows={4}
            placeholder={"cordless\n2-hour battery\ncompact design"}
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
          >
            <option value="" disabled>Select a category…</option>
            {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.icon} {c.label}</option>)}
          </select>
        </div>

        {/* ── Compare against ──────────────────────────────────────────────
            Same category, different brand. Selected rivals feed honest
            head-to-head contrasts into the AI draft and render a spec table on
            the published review (when this review links a catalog product). */}
        <div>
          <label className="block text-sm text-prose-muted mb-1.5">
            Compare against <span className="text-prose-faint">(optional — up to {MAX_COMPETITORS})</span>
          </label>
          {!category ? (
            <p className="text-xs text-prose-faint">Pick a category to see comparable products.</p>
          ) : competitorOptions.length === 0 ? (
            <p className="text-xs text-prose-faint">
              No other {CATEGORIES.find((c) => c.slug === category)?.label ?? 'category'} products in the catalog yet.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {competitorOptions.map((p) => {
                  const active = comparisonSlugs.includes(p.slug)
                  const n = specCount(p)
                  const atCap = !active && comparisonSlugs.length >= MAX_COMPETITORS
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleCompetitor(p.slug)}
                      disabled={atCap}
                      className={`px-3 py-2.5 text-xs font-semibold rounded-lg border transition-colors text-left min-h-[44px] ${
                        active
                          ? 'bg-accent text-white border-accent'
                          : atCap
                          ? 'bg-surface-sunken border-soft text-prose-faint opacity-50 cursor-not-allowed'
                          : 'bg-surface-sunken border-strong text-prose-muted hover:border-accent-border/60 hover:text-prose'
                      }`}
                    >
                      {p.brand && <span className={active ? 'text-white/80' : 'text-prose-faint'}>{p.brand} · </span>}
                      {p.name}
                      <span className={active ? 'text-white/70' : 'text-prose-faint'}> · {n} spec{n === 1 ? '' : 's'}</span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-xs text-prose-faint">
                {selectedCompetitors.length > 0
                  ? `${selectedCompetitors.length} selected. Products with no specs still inform the prose but add no table rows.`
                  : 'The spec table needs at least one rival with specs and this review linked to a catalog product.'}
              </p>
            </>
          )}
        </div>

      {/* ── Your Experience ─────────────────────────────────────────────── */}
      <div className="bg-surface border border-accent-border/30 rounded-xl p-5 space-y-4">
        <div>
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-0.5">Your Experience</p>
          <p className="text-xs text-prose-faint">Your gut-feel rating shapes the AI&apos;s four sub-scores. The saved overall is computed from those sub-scores — edit them later in the workspace.</p>
        </div>

        {/* Rating picker — hint only, not persisted */}
        <div>
          <label className="block text-sm text-prose-muted mb-2">
            Your gut-feel rating <span className="text-danger-ink">*</span>
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setInputRating(n)}
                className={`min-h-[44px] py-3 text-sm font-bold rounded-lg transition-colors ${
                  inputRating === n
                    ? 'bg-accent text-white'
                    : 'bg-surface-sunken border border-soft text-prose-muted hover:border-accent-border/60 hover:text-prose'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {inputRating !== null && (
            <p className="mt-1 text-xs text-accent-text-soft">
              {inputRating <= 3 ? 'Rough — not recommended' : inputRating <= 5 ? 'Below average' : inputRating <= 7 ? 'Solid pick' : inputRating <= 9 ? 'Really good' : 'Best in class'}
            </p>
          )}
        </div>

        {/* Testing duration + Price in a 2-col grid on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-prose-muted mb-1.5">How long tested</label>
            <select
              value={testingDuration}
              onChange={(e) => setTestingDuration(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-sunken border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
            >
              <option value="">— select —</option>
              {TESTING_DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-prose-muted mb-1.5">Price paid (cents)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pricePaid}
              onChange={(e) => setPricePaid(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 2999 = $29.99"
              className="w-full px-4 py-2.5 bg-surface-sunken border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
            />
            {pricePaid && !isNaN(parseInt(pricePaid, 10)) && (
              <p className="mt-1 text-xs text-accent-text-soft">${(parseInt(pricePaid, 10) / 100).toFixed(2)}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm text-prose-muted mb-1.5">How did you use it? <span className="text-prose-faint">(optional)</span></label>
          <textarea
            value={howYouUsedIt}
            onChange={(e) => setHowYouUsedIt(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="e.g. Built a backyard deck over 3 weekends. Used it for pilot holes, driving screws, mixing grout."
            className="w-full px-4 py-2.5 bg-surface-sunken border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Standout moment <span className="text-prose-faint">(optional)</span></label>
          <textarea
            value={standoutMoment}
            onChange={(e) => setStandoutMoment(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="e.g. Battery lasted the entire weekend — never had to stop and charge."
            className="w-full px-4 py-2.5 bg-surface-sunken border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
          />
        </div>
      </div>

        <div>
          <label className="block text-sm text-prose-muted mb-1.5">
            Inline image slots <span className="text-prose-faint">(empty placeholders to fill from the editor)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {([
              { v: 'auto', l: 'Let Claude pick' },
              { v: 0,      l: '0 (none)' },
              { v: 2,      l: '2' },
              { v: 3,      l: '3' },
              { v: 4,      l: '4' },
            ] as Array<{ v: number | 'auto'; l: string }>).map((opt) => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => setImageSlots(opt.v)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg min-h-[36px] transition-colors ${
                  imageSlots === opt.v
                    ? 'bg-accent text-white'
                    : 'bg-surface border border-soft text-prose-muted hover:border-accent-border/60'
                }`}
              >{opt.l}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-prose-faint">Fill or replace each one from the inline-images panel after the draft is created.</p>
        </div>
      </div>

      {error && (
        <p className="text-danger-ink text-sm bg-danger-bg border border-danger-line rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!productName.trim()}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          ✨ Generate with AI → Edit
        </button>
        <button
          type="button"
          onClick={handleSkipToBlank}
          disabled={!productName.trim()}
          className="px-5 py-2.5 bg-surface-raised hover:bg-surface disabled:opacity-40 text-prose-muted text-sm rounded-xl transition-colors"
        >
          Skip to blank draft
        </button>
        <Link href="/dashboard/reviews" className="px-5 py-2.5 text-prose-faint hover:text-prose text-sm transition-colors">
          Cancel
        </Link>
      </div>
    </div>
  )
}
