'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'

const STORAGE_KEY = 'bd:review-wizard-draft'

type Step = 'idea' | 'generating' | 'preview' | 'saving'

interface ProductOption {
  id: string
  slug: string
  name: string
  store: string
  affiliate_url: string | null
  non_affiliate_url: string | null
}

export function ReviewCreateWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idea')
  const [error, setError] = useState<string | null>(null)

  const [description, setDescription]   = useState('')
  const [productName, setProductName]   = useState('')
  const [productSlug, setProductSlug]   = useState('')
  const [keyFeatures, setKeyFeatures]   = useState('')
  const [category, setCategory]         = useState('other')
  const [imageSlots, setImageSlots]     = useState<number | 'auto'>('auto')
  const [suggesting, setSuggesting]     = useState(false)
  const [suggestions, setSuggestions]   = useState<{ productName: string; angle: string; keyFeatures: string[] }[]>([])

  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved.description)  setDescription(saved.description)
      if (saved.productName)  setProductName(saved.productName)
      if (saved.productSlug)  setProductSlug(saved.productSlug)
      if (saved.keyFeatures)  setKeyFeatures(saved.keyFeatures)
      if (saved.category)     setCategory(saved.category)
      if (saved.imageSlots !== undefined) setImageSlots(saved.imageSlots)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ description, productName, productSlug, keyFeatures, category, imageSlots }))
    } catch { /* ignore */ }
  }, [description, productName, productSlug, keyFeatures, category, imageSlots])

  const [previewDraft, setPreviewDraft] = useState<{
    title: string; excerpt: string; content: string
    rating: number; pros: string[]; cons: string[]; imagePrompt: string
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
    if (match) setProductName(match.name)
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
    setStep('generating'); setError(null)

    try {
      const genRes = await fetch('/api/claude/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          category,
          keyFeatures: keyFeatures.split('\n').map(f => f.trim()).filter(Boolean),
          imageSlots,
          ...(productSlug.trim() ? { productSlug: productSlug.trim() } : {}),
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
        verdict: string; rating: number; pros: string[]; cons: string[]
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

      setPreviewDraft({
        title: draft.title, excerpt: draft.excerpt, content,
        rating: Math.round(draft.rating ?? 7),
        pros: draft.pros ?? [], cons: draft.cons ?? [],
        imagePrompt: genJson.imagePrompt ?? '',
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
          rating: previewDraft.rating,
          pros: previewDraft.pros,
          cons: previewDraft.cons,
          product_slug: productSlug.trim() || null,
          disclosure_acknowledged: false,
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
          rating: 7,
          pros: [],
          cons: [],
          product_slug: productSlug.trim() || null,
          disclosure_acknowledged: false,
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
        <div className="w-8 h-8 border-4 border-gray-800 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-gray-300 font-medium">{label}</p>
        <p className="text-xs text-gray-600">This can take 30–60 seconds</p>
      </div>
    )
  }

  if (step === 'preview' && previewDraft) {
    const plainText = previewDraft.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const preview = plainText.length > 500 ? plainText.slice(0, 500) + '…' : plainText
    return (
      <div className="space-y-5">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold flex-1">Draft preview</p>
            <span className="text-sm font-bold text-yellow-400">{previewDraft.rating}/10</span>
          </div>
          <h2 className="text-lg font-black text-white leading-snug">{previewDraft.title}</h2>
          {previewDraft.excerpt && (
            <p className="text-sm text-gray-400 italic">{previewDraft.excerpt}</p>
          )}
          <p className="text-sm text-gray-300 leading-relaxed">{preview}</p>
          {previewDraft.pros.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <p className="text-xs text-green-500 font-semibold mb-1">Pros</p>
                <ul className="space-y-0.5">
                  {previewDraft.pros.map((p, i) => <li key={i} className="text-xs text-gray-400">+ {p}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-xs text-red-400 font-semibold mb-1">Cons</p>
                <ul className="space-y-0.5">
                  {previewDraft.cons.map((c, i) => <li key={i} className="text-xs text-gray-400">- {c}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
        {error && (
          <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">{error}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            ✓ Save &amp; open editor
          </button>
          <button
            type="button"
            onClick={() => { setPreviewDraft(null); setStep('generating'); handleGenerate() }}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors"
          >
            ↺ Regenerate
          </button>
          <button
            type="button"
            onClick={() => { setPreviewDraft(null); setStep('idea') }}
            className="px-5 py-2.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            ← Edit inputs
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div className="bg-gray-900 border border-orange-900/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-orange-400">✨ Describe the product</p>
          <span className="text-xs text-gray-600">Claude will suggest product name + key features</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 'review of the DeWalt 20V cordless drill I've been using for deck projects'"
            className="flex-1 px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            onKeyDown={(e) => { if (e.key === 'Enter' && !suggesting) handleSuggest() }}
          />
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggesting || !description.trim()}
            className="shrink-0 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {suggesting ? 'Thinking…' : 'Suggest'}
          </button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Pick an angle to fill the form — or dismiss to write your own:</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pickSuggestion(s)}
                className="text-left p-3 bg-gray-950 border border-gray-700 hover:border-orange-600/60 rounded-xl transition-colors group"
              >
                <p className="text-xs text-orange-400 font-medium mb-1 group-hover:text-orange-300">{s.angle}</p>
                <p className="text-sm text-white font-semibold leading-snug mb-2">{s.productName}</p>
                <ul className="space-y-0.5">
                  {s.keyFeatures.slice(0, 3).map((kf, j) => (
                    <li key={j} className="text-xs text-gray-500">· {kf}</li>
                  ))}
                  {s.keyFeatures.length > 3 && <li className="text-xs text-gray-600">+{s.keyFeatures.length - 3} more</li>}
                </ul>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSuggestions([])}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Dismiss — I&apos;ll write my own
          </button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Product name</label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="What product is this?"
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">
            Affiliate product <span className="text-gray-600">(optional — auto-embeds a [[BUY:slug]] link)</span>
          </label>
          <select
            value={productSlug}
            onChange={(e) => handlePickProduct(e.target.value)}
            disabled={!productsLoaded}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
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
          <p className="mt-1 text-xs text-gray-600">
            Picking a product locks the product name to match and embeds one affiliate link in the draft. Manage the list at{' '}
            <Link href="/dashboard/admin/products" className="text-orange-400 hover:text-orange-300">/dashboard/admin/products</Link>.
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Key features <span className="text-gray-600">(one per line, optional)</span></label>
          <textarea
            value={keyFeatures}
            onChange={(e) => setKeyFeatures(e.target.value)}
            rows={4}
            placeholder={"cordless\n2-hour battery\ncompact design"}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.icon} {c.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">
            Inline image slots <span className="text-gray-600">(empty placeholders to fill from the editor)</span>
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
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-900 border border-gray-800 text-gray-300 hover:border-orange-700/60'
                }`}
              >{opt.l}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-600">Fill or replace each one from the inline-images panel after the draft is created.</p>
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!productName.trim()}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          ✨ Generate with AI → Edit
        </button>
        <button
          type="button"
          onClick={handleSkipToBlank}
          disabled={!productName.trim()}
          className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm rounded-xl transition-colors"
        >
          Skip to blank draft
        </button>
        <Link href="/dashboard/reviews" className="px-5 py-2.5 text-gray-500 hover:text-gray-300 text-sm transition-colors">
          Cancel
        </Link>
      </div>
    </div>
  )
}
