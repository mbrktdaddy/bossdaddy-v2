'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'

type Step = 'idea' | 'generating' | 'saving'

export function ArticleCreateWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idea')
  const [error, setError] = useState<string | null>(null)

  // Step 1 state
  const [description, setDescription] = useState('')
  const [topic, setTopic]             = useState('')
  const [keyPoints, setKeyPoints]     = useState('')
  const [category, setCategory]       = useState('other')
  const [suggesting, setSuggesting]   = useState(false)

  async function handleSuggest() {
    if (!description.trim()) { setError('Describe your idea first'); return }
    setSuggesting(true); setError(null)
    try {
      const res = await fetch('/api/claude/suggest-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, type: 'article' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Suggest failed')
      if (json.topic) setTopic(json.topic)
      if (json.keyPoints?.length) setKeyPoints(json.keyPoints.join('\n'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suggest failed')
    }
    setSuggesting(false)
  }

  async function handleGenerate() {
    if (!topic.trim()) { setError('Enter a topic first (or use Suggest above)'); return }
    setStep('generating'); setError(null)

    try {
      // 1. Generate content via Claude
      const genRes = await fetch('/api/claude/article-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          category,
          keyPoints: keyPoints.split('\n').map(p => p.trim()).filter(Boolean),
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

      const draft = genJson.draft as { title: string; excerpt: string; introduction: string; sections: { heading: string; body: string }[]; conclusion: string }
      const content = [
        draft.introduction,
        ...(draft.sections ?? []).map((s) => {
          const bodyHtml = s.body.split(/\n\n+/).map((p) => `<p>${p.trim()}</p>`).join('\n')
          return `<h2>${s.heading}</h2>\n${bodyHtml}`
        }),
        draft.conclusion ? `<h2>Wrapping Up</h2>\n<p>${draft.conclusion}</p>` : '',
      ].filter(Boolean).join('\n\n')

      // 2. Save as draft
      setStep('saving')
      const saveRes = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          category,
          excerpt: draft.excerpt,
          content,
          image_url: null,
        }),
      })
      const saveJson = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveJson.error ?? 'Save failed')

      // 3. Navigate to workspace
      router.push(`/dashboard/articles/${saveJson.article.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setStep('idea')
    }
  }

  async function handleSkipToBlank() {
    setStep('saving'); setError(null)
    try {
      const res = await fetch('/api/articles', {
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
      router.push(`/dashboard/articles/${json.article.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
      setStep('idea')
    }
  }

  if (step !== 'idea') {
    const label = step === 'generating' ? '✍️ Writing full article with Claude…' : '💾 Saving draft…'
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

      {/* Step 1: Suggest prompt from rough description */}
      <div className="bg-gray-900 border border-orange-900/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-orange-400">✨ Describe your idea</p>
          <span className="text-xs text-gray-600">Claude will suggest a topic and key points</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 'help dads pick their first cordless drill'"
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

      {/* Step 2: Review / edit topic + key points, pick category */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What's this article about?"
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Key points <span className="text-gray-600">(one per line, optional)</span></label>
          <textarea
            value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)}
            rows={4}
            placeholder={"safety tips\nbudget options\nbest for beginners"}
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
          disabled={!topic.trim()}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          ✨ Generate with AI → Edit
        </button>
        <button
          type="button"
          onClick={handleSkipToBlank}
          className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors"
        >
          Skip to blank draft
        </button>
        <Link
          href="/dashboard/articles"
          className="px-5 py-2.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          Cancel
        </Link>
      </div>
    </div>
  )
}
