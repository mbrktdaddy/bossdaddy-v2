'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'

const STORAGE_KEY = 'bd:guide-wizard-draft'

type Step = 'idea' | 'generating' | 'preview' | 'saving'

interface ProductOption {
  id: string
  slug: string
  name: string
  store: string
  affiliate_url: string | null
  non_affiliate_url: string | null
}

export function GuideCreateWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idea')
  const [error, setError] = useState<string | null>(null)

  // Step 1 state
  const [description, setDescription] = useState('')
  const [topic, setTopic]             = useState('')
  const [keyPoints, setKeyPoints]     = useState('')
  const [context, setContext]         = useState('')
  const [category, setCategory]       = useState('')
  const [imageSlots, setImageSlots]   = useState<number | 'auto'>('auto')
  const [suggesting, setSuggesting]   = useState(false)
  const [suggestions, setSuggestions] = useState<{ topic: string; angle: string; keyPoints: string[] }[]>([])

  // Restore from localStorage on first mount
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved.topic)       setTopic(saved.topic)
      if (saved.keyPoints)   setKeyPoints(saved.keyPoints)
      if (saved.context)     setContext(saved.context)
      if (saved.category)    setCategory(saved.category)
      if (saved.description) setDescription(saved.description)
      if (saved.imageSlots !== undefined) setImageSlots(saved.imageSlots)
    } catch { /* ignore */ }
  }, [])

  // Persist form state to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ description, topic, keyPoints, context, category, imageSlots }))
    } catch { /* ignore */ }
  }, [description, topic, keyPoints, context, category, imageSlots])

  // Holds generated draft between the preview step and the save step
  const [previewDraft, setPreviewDraft] = useState<{
    title: string; excerpt: string; content: string; imagePrompt: string
  } | null>(null)

  // Products for multi-select picker (roundups, gift guides, etc.)
  const [products, setProducts]             = useState<ProductOption[]>([])
  const [productsLoaded, setProductsLoaded] = useState(false)
  const [selectedSlugs, setSelectedSlugs]   = useState<string[]>([])
  const [productFilter, setProductFilter]   = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/products')
      .then((r) => r.json())
      .then((json) => { if (!cancelled) setProducts(json.products ?? []) })
      .catch(() => { /* non-blocking */ })
      .finally(() => { if (!cancelled) setProductsLoaded(true) })
    return () => { cancelled = true }
  }, [])

  function toggleSlug(slug: string) {
    setSelectedSlugs((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug])
  }

  async function handleSuggest() {
    if (!description.trim()) { setError('Describe your idea first'); return }
    setSuggesting(true); setError(null)
    try {
      const res = await fetch('/api/claude/suggest-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, type: 'guide' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Suggest failed')
      if (json.suggestions?.length) {
        setSuggestions(json.suggestions)
      } else {
        // Fallback for single-suggestion response shape
        if (json.topic) setTopic(json.topic)
        if (json.keyPoints?.length) setKeyPoints(json.keyPoints.join('\n'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suggest failed')
    }
    setSuggesting(false)
  }

  function pickSuggestion(s: { topic: string; keyPoints: string[] }) {
    setTopic(s.topic)
    setKeyPoints(s.keyPoints.join('\n'))
    setSuggestions([])
  }

  async function handleGenerate() {
    if (!topic.trim()) { setError('Enter a topic first (or use Suggest above)'); return }
    if (!category) { setError('Select a category before generating'); return }
    setStep('generating'); setError(null)

    try {
      // 1. Generate content via Claude
      const genRes = await fetch('/api/claude/guide-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          category,
          keyPoints: keyPoints.split('\n').map(p => p.trim()).filter(Boolean),
          ...(context.trim() ? { context: context.trim() } : {}),
          imageSlots,
          ...(selectedSlugs.length ? { productSlugs: selectedSlugs } : {}),
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
        conclusion: string
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
        draft.conclusion ? `<h2>Wrapping Up</h2>\n<p>${draft.conclusion}</p>` : '',
      ].filter(Boolean).join('\n\n')

      // 2. Show preview before committing to DB
      setPreviewDraft({ title: draft.title, excerpt: draft.excerpt, content, imagePrompt: genJson.imagePrompt ?? '' })
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
      const saveRes = await fetch('/api/guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: previewDraft.title,
          category,
          excerpt: previewDraft.excerpt,
          content: previewDraft.content,
          image_url: null,
        }),
      })
      const saveJson = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveJson.error ?? 'Save failed')

      sessionStorage.setItem(`bd:hero-prompt:${saveJson.article.id}`, previewDraft.imagePrompt)
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
      router.push(`/dashboard/guides/${saveJson.article.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setStep('preview')
    }
  }

  async function handleSkipToBlank() {
    setStep('saving'); setError(null)
    try {
      const res = await fetch('/api/guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: topic || 'Untitled draft',
          category,
          excerpt: '',
          content: '<p>Start writing here…</p>',
          image_url: null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      router.push(`/dashboard/guides/${json.article.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
      setStep('idea')
    }
  }

  if (step === 'generating' || step === 'saving') {
    const label = step === 'generating' ? '✍️ Writing full guide with Claude…' : '💾 Saving draft…'
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-8 h-8 border-4 border-soft border-t-orange-500 rounded-full animate-spin" />
        <p className="text-prose-muted font-medium">{label}</p>
        <p className="text-xs text-prose-faint">This can take 30–60 seconds</p>
      </div>
    )
  }

  if (step === 'preview' && previewDraft) {
    const plainText = previewDraft.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const preview = plainText.length > 500 ? plainText.slice(0, 500) + '…' : plainText
    return (
      <div className="space-y-5">
        <div className="bg-surface border border-strong rounded-xl p-5 space-y-3">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">Draft preview</p>
          <h2 className="text-lg font-black text-prose leading-snug">{previewDraft.title}</h2>
          {previewDraft.excerpt && (
            <p className="text-sm text-prose-muted italic">{previewDraft.excerpt}</p>
          )}
          <p className="text-sm text-prose-muted leading-relaxed">{preview}</p>
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

      {/* Step 1: Suggest prompt from rough description */}
      <div className="bg-surface border border-accent-border/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-accent-text-soft">✨ Describe your idea</p>
          <span className="text-xs text-prose-faint">Claude will suggest a topic and key points</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 'help dads pick their first cordless drill'"
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

      {/* Suggestion cards */}
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
                <p className="text-sm text-prose font-semibold leading-snug mb-2">{s.topic}</p>
                <ul className="space-y-0.5">
                  {s.keyPoints.slice(0, 3).map((kp, j) => (
                    <li key={j} className="text-xs text-prose-faint">· {kp}</li>
                  ))}
                  {s.keyPoints.length > 3 && <li className="text-xs text-prose-faint">+{s.keyPoints.length - 3} more</li>}
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

      {/* Step 2: Review / edit topic + key points, pick category */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What's this guide about?"
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
          />
        </div>

        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Key points <span className="text-prose-faint">(one per line, optional)</span></label>
          <textarea
            value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)}
            rows={4}
            placeholder={"safety tips\nbudget options\nbest for beginners"}
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-prose-muted mb-1.5">
            Context &amp; source material <span className="text-prose-faint">(optional, but recommended)</span>
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={6}
            maxLength={6000}
            placeholder={"Paste your full brief here — personal story, real numbers, brand names, sources, the arc you want to tell. Claude grounds the piece in these specifics instead of inventing them."}
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-y"
          />
          <p className="mt-1 text-xs text-prose-faint">
            The more real detail you give, the more accurate and personal the draft. {context.length}/6000
          </p>
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

        <div>
          <label className="block text-sm text-prose-muted mb-1.5">
            Affiliate products <span className="text-prose-faint">(optional — for roundups, gift guides)</span>
          </label>
          {!productsLoaded ? (
            <div className="px-4 py-2.5 bg-surface border border-strong rounded-lg text-sm text-prose-faint">
              Loading products…
            </div>
          ) : products.length === 0 ? (
            <div className="px-4 py-2.5 bg-surface border border-strong rounded-lg text-sm text-prose-faint">
              No products yet.{' '}
              <Link href="/dashboard/admin/products/new" className="text-accent-text-soft hover:text-accent">Add one →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                placeholder="Filter by name or slug…"
                className="w-full px-4 py-2 bg-surface-sunken border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
              />
              <div className="max-h-56 overflow-y-auto bg-surface border border-strong rounded-lg divide-y divide-soft">
                {products
                  .filter((p) => {
                    const q = productFilter.trim().toLowerCase()
                    return !q || p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
                  })
                  .map((p) => {
                    const checked = selectedSlugs.includes(p.slug)
                    const tag = p.affiliate_url ? (p.store === 'amazon' ? 'Amazon' : 'Affiliate') : p.non_affiliate_url ? 'Link' : 'No URL'
                    return (
                      <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-sunken">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSlug(p.slug)}
                          className="shrink-0"
                        />
                        <span className="min-w-0 flex-1 text-sm text-prose truncate">{p.name}</span>
                        <span className="shrink-0 text-xs text-prose-faint">{tag}</span>
                      </label>
                    )
                  })}
              </div>
              <p className="text-xs text-prose-faint">
                {selectedSlugs.length === 0
                  ? 'Leave empty to skip affiliate links. Each selection embeds one [[BUY:slug]] into the draft.'
                  : `${selectedSlugs.length} selected — Claude will embed one affiliate link per product, spaced across the guide.`}
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-danger-ink text-sm bg-danger-bg border border-danger-line rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!topic.trim()}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          ✨ Generate with AI → Edit
        </button>
        <button
          type="button"
          onClick={handleSkipToBlank}
          className="px-5 py-2.5 bg-surface-raised hover:bg-surface text-prose-muted text-sm rounded-xl transition-colors"
        >
          Skip to blank draft
        </button>
        <Link
          href="/dashboard/guides"
          className="px-5 py-2.5 text-prose-faint hover:text-prose text-sm transition-colors"
        >
          Cancel
        </Link>
      </div>
    </div>
  )
}
