'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export interface ArticleListItem {
  id: string
  title: string
  status: 'draft' | 'ready' | 'posted'
  scheduled_at: string | null
  source_title: string | null
  updated_at: string
}

const STATUS_STYLE: Record<string, string> = {
  draft:  'bg-surface-raised text-prose-muted border-strong/40',
  ready:  'bg-success-bg text-forest border-success-line',
  posted: 'bg-info-bg text-info-ink border-info-line',
}

export default function ArticlesPanel({ articles }: { articles: ArticleListItem[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function newArticle() {
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/social-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled article', source_type: 'original' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.article?.id) throw new Error(json.error ?? 'Could not create article')
      router.push(`/dashboard/social/articles/${json.article.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create article')
      setCreating(false)
    }
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <h2 className="text-lg font-black text-prose">X Articles</h2>
          <p className="text-xs text-prose-muted mt-0.5">Long-form posts for X. Edit, preview, and copy X-ready HTML.</p>
        </div>
        <button
          onClick={newArticle}
          disabled={creating}
          className="flex items-center gap-2 bg-surface-raised hover:bg-surface disabled:opacity-50 text-prose text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shrink-0 border border-soft"
        >
          {creating ? 'Creating…' : '+ New Article'}
        </button>
      </div>

      {error && <p className="text-xs text-danger-ink mb-2">{error}</p>}

      {articles.length === 0 ? (
        <p className="text-xs text-prose-faint bg-surface border border-soft rounded-xl px-4 py-6 text-center">
          No articles yet. Start one above, or use “Repurpose to X” to turn a review or guide into an article.
        </p>
      ) : (
        <ul className="space-y-2">
          {articles.map((a) => {
            const scheduled = a.scheduled_at ? new Date(a.scheduled_at) : null
            return (
              <li key={a.id}>
                <Link
                  href={`/dashboard/social/articles/${a.id}`}
                  className="flex items-center justify-between gap-3 bg-surface border border-soft hover:border-strong rounded-xl px-4 py-3 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-prose truncate">{a.title || 'Untitled article'}</span>
                    {a.source_title && (
                      <span className="block text-xs text-prose-faint truncate">from: {a.source_title}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {scheduled && (
                      <span className="text-xs text-purple-400 font-mono" suppressHydrationWarning>
                        📅 {scheduled.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize border ${STATUS_STYLE[a.status] ?? STATUS_STYLE.draft}`}>
                      {a.status}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
