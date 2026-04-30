'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResults {
  articles: { id: string; title: string; slug: string; status: string; category: string }[]
  reviews:  { id: string; title: string; slug: string; status: string; category: string; product_name: string }[]
  media:    { id: string; url: string; filename: string; alt_text: string | null }[]
}

export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({ articles: [], reviews: [], media: [] })
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Flat list of navigable results for keyboard
  const flat = [
    ...results.articles.map((a) => ({ kind: 'guide' as const, id: a.id, title: a.title, href: `/dashboard/guides/${a.id}`, meta: a.category })),
    ...results.reviews.map((r)  => ({ kind: 'review'  as const, id: r.id, title: r.title, href: `/dashboard/reviews/${r.id}`,  meta: r.product_name })),
    ...results.media.map((m)    => ({ kind: 'media'   as const, id: m.id, title: m.alt_text ?? m.filename, href: `/dashboard/media`, meta: m.filename })),
  ]

  // Keyboard shortcut: Cmd/Ctrl+K opens
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults({ articles: [], reviews: [], media: [] }); return }
    setLoading(true)
    const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`)
    if (res.ok) setResults(await res.json())
    setLoading(false)
  }, [])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 200)
    return () => clearTimeout(t)
  }, [query, runSearch])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCursor(0) }, [results])

  function navigate(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(flat.length - 1, c + 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
    if (e.key === 'Enter' && flat[cursor]) navigate(flat[cursor].href)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Search (⌘K)"
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs rounded-lg transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Search</span>
        <kbd className="hidden sm:inline text-xs font-mono bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 ml-2">⌘K</kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-20 px-4" onClick={() => setOpen(false)}>
      <div
        className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[70vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
          <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search articles, reviews, media…"
            className="flex-1 bg-transparent text-white placeholder-gray-600 focus:outline-none text-sm"
          />
          {loading && <span className="w-3 h-3 border-2 border-gray-700 border-t-orange-500 rounded-full animate-spin shrink-0" />}
          <button onClick={() => setOpen(false)} className="text-xs text-gray-600 hover:text-gray-400">Esc</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {query.trim().length < 2 ? (
            <p className="text-center text-gray-600 text-sm py-8">Type at least 2 characters to search.</p>
          ) : flat.length === 0 && !loading ? (
            <p className="text-center text-gray-600 text-sm py-8">No results.</p>
          ) : (
            <>
              {results.articles.length > 0 && (
                <div className="px-2 pt-3">
                  <p className="px-2 text-xs text-gray-600 uppercase tracking-wider font-semibold mb-1">Guides</p>
                  {results.articles.map((a, i) => {
                    const flatIdx = i
                    return (
                      <button
                        key={a.id}
                        onClick={() => navigate(`/dashboard/guides/${a.id}`)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          cursor === flatIdx ? 'bg-gray-800' : 'hover:bg-gray-900'
                        }`}
                      >
                        <p className="text-sm text-white truncate">{a.title}</p>
                        <p className="text-xs text-gray-500">{a.category} · {a.status}</p>
                      </button>
                    )
                  })}
                </div>
              )}

              {results.reviews.length > 0 && (
                <div className="px-2 pt-3">
                  <p className="px-2 text-xs text-gray-600 uppercase tracking-wider font-semibold mb-1">Reviews</p>
                  {results.reviews.map((r, i) => {
                    const flatIdx = results.articles.length + i
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate(`/dashboard/reviews/${r.id}`)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          cursor === flatIdx ? 'bg-gray-800' : 'hover:bg-gray-900'
                        }`}
                      >
                        <p className="text-sm text-white truncate">{r.title}</p>
                        <p className="text-xs text-gray-500">{r.product_name} · {r.status}</p>
                      </button>
                    )
                  })}
                </div>
              )}

              {results.media.length > 0 && (
                <div className="px-2 pt-3 pb-3">
                  <p className="px-2 text-xs text-gray-600 uppercase tracking-wider font-semibold mb-1">Media</p>
                  {results.media.map((m, i) => {
                    const flatIdx = results.articles.length + results.reviews.length + i
                    return (
                      <button
                        key={m.id}
                        onClick={() => navigate('/dashboard/media')}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                          cursor === flatIdx ? 'bg-gray-800' : 'hover:bg-gray-900'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.url} alt="" className="w-8 h-8 rounded object-cover shrink-0" loading="lazy" />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{m.alt_text ?? m.filename}</p>
                          <p className="text-xs text-gray-500 truncate">{m.filename}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-600 shrink-0 flex items-center gap-3">
          <span><kbd className="bg-gray-900 border border-gray-700 rounded px-1">↑↓</kbd> nav</span>
          <span><kbd className="bg-gray-900 border border-gray-700 rounded px-1">↵</kbd> open</span>
          <span><kbd className="bg-gray-900 border border-gray-700 rounded px-1">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
