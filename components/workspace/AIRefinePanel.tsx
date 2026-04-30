'use client'

import { useEffect, useState } from 'react'

interface Props {
  title: string
  category: string
  content: string
  productName?: string
  contentType: 'guide' | 'review'
  onRefined: (draft: RefinedDraft) => void
  externalInstruction?: string
  onExternalInstructionUsed?: () => void
}

interface RefinedDraft {
  title?: string
  excerpt?: string
  introduction?: string
  sections?: { heading: string; body: string }[]
  conclusion?: string
  verdict?: string
  rating?: number
  pros?: string[]
  cons?: string[]
}

export function AIRefinePanel({ title, category, content, productName, contentType, onRefined, externalInstruction, onExternalInstructionUsed }: Props) {
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When a flag "Fix with AI" button sets an external instruction, adopt it
  useEffect(() => {
    if (externalInstruction) {
      setInstruction(externalInstruction)
      onExternalInstructionUsed?.()
    }
  }, [externalInstruction]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefine() {
    if (!instruction.trim()) { setError('Enter refinement instructions first.'); return }
    if (!content) { setError('Generate or write content before refining.'); return }

    setLoading(true)
    setError(null)
    try {
      const endpoint = contentType === 'guide' ? '/api/claude/article-refine' : '/api/claude/review-refine'
      const body = contentType === 'guide'
        ? { title, category, content, instruction }
        : { title, product_name: productName, category, content, instruction }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Refinement failed')
      onRefined(json.draft as RefinedDraft)
      setInstruction('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed')
    }
    setLoading(false)
  }

  return (
    <div className="bg-gray-900 border border-orange-900/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-orange-400">✨ AI Refine</p>
        <span className="text-xs text-gray-600">Iterate without losing structure</span>
      </div>
      <div className="flex gap-2">
        <input
          id="ai-refine-instruction"
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. 'make it more casual', 'add a section on safety', 'shorten the intro'"
          className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
          onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleRefine() }}
        />
        <button
          type="button"
          onClick={handleRefine}
          disabled={loading || !instruction.trim()}
          className="shrink-0 text-sm px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-semibold rounded-lg transition-colors"
        >
          {loading ? 'Refining…' : 'Apply'}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
