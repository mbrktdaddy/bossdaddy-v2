'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'

type Step = 'idea' | 'generating' | 'saving'

export function ReviewCreateWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idea')
  const [error, setError] = useState<string | null>(null)

  const [description, setDescription]   = useState('')
  const [productName, setProductName]   = useState('')
  const [productSlug, setProductSlug]   = useState('')
  const [keyFeatures, setKeyFeatures]   = useState('')
  const [category, setCategory]         = useState('other')
  const [suggesting, setSuggesting]     = useState(false)

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
      if (json.productName) setProductName(json.productName)
      if (json.keyFeatures?.length) setKeyFeatures(json.keyFeatures.join('\n'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suggest failed')
    }
    setSuggesting(false)
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
      }

      const content = [
        draft.introduction,
        ...(draft.sections ?? []).map((s) => {
          const bodyHtml = s.body.split(/\n\n+/).map((p) => `<p>${p.trim()}</p>`).join('\n')
          return `<h2>${s.heading}</h2>\n${bodyHtml}`
        }),
        draft.verdict ? `<h2>The Verdict</h2>\n<p>${draft.verdict}</p>` : '',
      ].filter(Boolean).join('\n\n')

      setStep('saving')
      const saveRes = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          product_name: productName,
          category,
          excerpt: draft.excerpt,
          content,
          image_url: null,
          rating: Math.round(draft.rating ?? 7),
          pros: draft.pros ?? [],
          cons: draft.cons ?? [],
          disclosure_acknowledged: false,
        }),
      })
      const saveJson = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveJson.error ?? 'Save failed')

      router.push(`/dashboard/reviews/${saveJson.review.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setStep('idea')
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

  if (step !== 'idea') {
    const label = step === 'generating' ? '✍️ Writing full review with Claude…' : '💾 Saving draft…'
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-8 h-8 border-4 border-gray-800 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-gray-300 font-medium">{label}</p>
        <p className="text-xs text-gray-600">This can take 30–60 seconds</p>
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
            Product slug <span className="text-gray-600">(optional — auto-embeds a [[BUY:slug]] affiliate link)</span>
          </label>
          <input
            type="text"
            value={productSlug}
            onChange={(e) => setProductSlug(e.target.value.toLowerCase())}
            placeholder="e.g. enfamil-enspire"
            pattern="[a-z0-9-]+"
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <p className="mt-1 text-xs text-gray-600">
            Must match a row in <code className="text-orange-400">/dashboard/admin/products</code>. Leave blank to skip.
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
