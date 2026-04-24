'use client'

import { useState } from 'react'

interface Suggestion {
  type: 'article' | 'review'
  id: string
  title: string
  slug: string
  url: string
  excerpt: string
}

interface Props {
  title: string
  excerpt: string
  category: string
  currentId: string
  contentType: 'article' | 'review'
  content: string
  onInsert: (markup: string) => void
}

export function InternalLinkPanel({ title, excerpt, category, currentId, contentType, content, onInsert }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/claude/suggest-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, excerpt, category, current_id: currentId, content_type: contentType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to suggest links')
      setSuggestions(json.suggestions ?? [])
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
    setLoading(false)
  }

  function insertLink(s: Suggestion) {
    const markup = `<p><a href="${s.url}">${s.title}</a></p>`
    onInsert(markup)
  }

  return (
    <details className="bg-gray-900 border border-gray-800 rounded-xl">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-green-400">🔗</span> Suggest internal links
        </span>
        <span className="text-xs text-gray-600">Relevant published content to link</span>
      </summary>

      <div className="px-4 pb-4">
        {!loaded && !loading && (
          <button
            onClick={load}
            className="text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg transition-colors"
          >
            ✨ Get suggestions
          </button>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-gray-500 py-2 text-sm">
            <div className="w-3 h-3 border-2 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
            Claude is finding relevant content…
          </div>
        )}
        {loaded && suggestions.length === 0 && (
          <p className="text-sm text-gray-600 py-2">No related published content found in this category yet.</p>
        )}
        {loaded && suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((s) => {
              const alreadyInserted = content.includes(`href="${s.url}"`)
              return (
              <div key={`${s.type}-${s.id}`} className="flex items-center gap-3 p-3 bg-gray-950 border border-gray-800 rounded-lg">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      s.type === 'article'
                        ? 'bg-blue-950/40 text-blue-400 border-blue-900/40'
                        : 'bg-orange-950/40 text-orange-400 border-orange-900/40'
                    }`}>
                      {s.type}
                    </span>
                    <p className="text-sm text-white truncate">{s.title}</p>
                  </div>
                  {s.excerpt && <p className="text-xs text-gray-500 line-clamp-1">{s.excerpt}</p>}
                </div>
                {alreadyInserted ? (
                  <span
                    title="Already linked in content"
                    className="shrink-0 text-xs px-3 py-1.5 bg-green-950/40 border border-green-900/40 text-green-400 rounded-lg"
                  >
                    ✓ Inserted
                  </span>
                ) : (
                  <button
                    onClick={() => insertLink(s)}
                    className="shrink-0 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                  >
                    + Insert link
                  </button>
                )}
              </div>
              )
            })}
            <button
              onClick={load}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors mt-1"
            >
              ↻ Re-suggest
            </button>
          </div>
        )}
        {error && (
          <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded px-3 py-2 mt-2">{error}</p>
        )}
      </div>
    </details>
  )
}
