'use client'

import { useEffect, useMemo, useState } from 'react'
import { extractH2Headings } from '@/lib/inlineImages'
import { insertAtPosition } from '@/lib/inlineImages'
import {
  type InternalLink,
  buildInternalLinkMarkup,
  extractInternalLinks,
  moveLinkToPosition,
  removeLinkAtPosition,
  updateLinkText,
} from '@/lib/internalLinks'

interface Suggestion {
  type: 'guide' | 'review'
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
  contentType: 'guide' | 'review'
  content: string
  onChangeContent: (next: string) => void
}

export function InternalLinkPanel({
  title,
  excerpt,
  category,
  currentId,
  contentType,
  content,
  onChangeContent,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [posKey, setPosKey] = useState<string>('end')

  const existing = useMemo(() => extractInternalLinks(content), [content])
  const headings = useMemo(() => extractH2Headings(content), [content])

  function resolvePosition() {
    if (posKey === 'start') return { kind: 'start' as const }
    if (posKey === 'end')   return { kind: 'end' as const }
    return { kind: 'afterHeading' as const, index: Number(posKey.replace('h-', '')) }
  }

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

  function insertSuggestion(s: Suggestion) {
    const markup = buildInternalLinkMarkup(s.url, s.title)
    onChangeContent(insertAtPosition(content, markup, resolvePosition()))
  }

  function handleMove(currentPos: number, targetPos: number) {
    onChangeContent(moveLinkToPosition(content, currentPos, targetPos))
  }
  function handleRemove(position: number) {
    if (!confirm('Remove this internal link?')) return
    onChangeContent(removeLinkAtPosition(content, position))
  }
  function handleTextChange(position: number, nextText: string) {
    onChangeContent(updateLinkText(content, position, nextText))
  }

  const positionOptions = [
    { value: 'start', label: 'Start of article' },
    ...headings.map((h, i) => ({
      value: `h-${i}`,
      label: `After: ${h.text.length > 40 ? h.text.slice(0, 40) + '…' : h.text}`,
    })),
    { value: 'end', label: 'End of article' },
  ]

  return (
    <details className="bg-surface border border-soft rounded-xl">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-green-700">🔗</span> Internal links
          {existing.length > 0 && (
            <span className="px-2 py-0.5 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs">
              {existing.length} in article
            </span>
          )}
        </span>
      </summary>

      <div className="px-4 pb-4 space-y-4">

        {/* ── Currently in this guide ───────────────────────────────── */}
        {existing.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs text-prose-faint uppercase tracking-widest font-semibold">Currently in this guide</p>
            {existing.map((link) => (
              <ExistingLinkCard
                key={`${link.position}-${link.href}`}
                link={link}
                total={existing.length}
                onMove={(toPos) => handleMove(link.position, toPos)}
                onRemove={() => handleRemove(link.position)}
                onTextCommit={(t) => handleTextChange(link.position, t)}
              />
            ))}
          </section>
        )}

        {/* ── AI suggestions ──────────────────────────────────────────── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-prose-faint uppercase tracking-widest font-semibold">Suggest more</p>
            {loaded && (
              <button
                onClick={load}
                className="text-xs text-prose-faint hover:text-prose transition-colors"
              >↻ Re-suggest</button>
            )}
          </div>

          {!loaded && !loading && (
            <button
              onClick={load}
              className="text-xs px-3 py-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg min-h-[36px] transition-colors"
            >
              ✨ Get suggestions
            </button>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-prose-faint py-2 text-sm">
              <div className="w-3 h-3 border-2 border-strong border-t-orange-500 rounded-full animate-spin" />
              Claude is finding relevant content…
            </div>
          )}
          {loaded && suggestions.length === 0 && (
            <p className="text-sm text-prose-faint py-2">No related published content found in this category yet.</p>
          )}
          {loaded && suggestions.length > 0 && (
            <>
              <div>
                <label className="block text-xs text-prose-muted mb-1">Insert at position</label>
                <select
                  value={posKey}
                  onChange={(e) => setPosKey(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-sunken border border-strong rounded-lg text-sm text-prose focus:outline-none focus:ring-1 focus:ring-accent-hover"
                >
                  {positionOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                {suggestions.map((s) => {
                  const alreadyInserted = existing.some((l) => l.path === s.url)
                  return (
                    <div key={`${s.type}-${s.id}`} className="flex items-center gap-3 p-3 bg-surface-sunken border border-soft rounded-lg">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            s.type === 'guide'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-accent-tint text-accent-text-soft border-accent-border/40'
                          }`}>
                            {s.type}
                          </span>
                          <p className="text-sm text-prose truncate">{s.title}</p>
                        </div>
                        {s.excerpt && <p className="text-xs text-prose-faint line-clamp-1">{s.excerpt}</p>}
                      </div>
                      {alreadyInserted ? (
                        <span
                          title="Already linked in content"
                          className="shrink-0 text-xs px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg min-h-[36px]"
                        >
                          ✓ Inserted
                        </span>
                      ) : (
                        <button
                          onClick={() => insertSuggestion(s)}
                          className="shrink-0 text-xs px-3 py-2 bg-surface-raised hover:bg-stone-100 text-prose-muted rounded-lg min-h-[36px] transition-colors"
                        >
                          + Insert link
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
        )}
      </div>
    </details>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
interface ExistingLinkCardProps {
  link: InternalLink
  total: number
  onMove: (toPos: number) => void
  onRemove: () => void
  onTextCommit: (next: string) => void
}

function ExistingLinkCard({ link, total, onMove, onRemove, onTextCommit }: ExistingLinkCardProps) {
  const [text, setText] = useState(link.text)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setText(link.text) }, [link.text])

  function commitText() {
    if (text !== link.text && text.trim().length > 0) onTextCommit(text)
    else if (!text.trim()) setText(link.text)
  }

  return (
    <div className="p-3 bg-surface-sunken border border-soft rounded-lg space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            link.type === 'guide'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-accent-tint text-accent-text-soft border-accent-border/40'
          }`}>{link.type}</span>
          <select
            value={link.position}
            onChange={(e) => onMove(Number(e.target.value))}
            disabled={total <= 1}
            className="px-2 py-1.5 bg-surface border border-strong rounded-lg text-xs text-prose min-h-[36px] focus:outline-none focus:ring-1 focus:ring-accent-hover disabled:opacity-50"
            title="Move to position"
          >
            {Array.from({ length: total }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>Position {n} of {total}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(link.position - 1)}
            disabled={link.position === 1}
            className="px-2.5 py-1.5 bg-surface-raised hover:bg-stone-100 disabled:opacity-30 text-prose-muted text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Move up"
          >↑</button>
          <button
            type="button"
            onClick={() => onMove(link.position + 1)}
            disabled={link.position === total}
            className="px-2.5 py-1.5 bg-surface-raised hover:bg-stone-100 disabled:opacity-30 text-prose-muted text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Move down"
          >↓</button>
          <button
            type="button"
            onClick={onRemove}
            className="px-2.5 py-1.5 bg-transparent hover:bg-red-50 text-prose-faint hover:text-red-600 text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Remove link"
          >🗑</button>
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-prose-faint mb-0.5">Link text</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="w-full px-2.5 py-1.5 bg-surface border border-soft rounded-lg text-xs text-prose focus:outline-none focus:ring-1 focus:ring-accent-hover"
        />
      </div>
      <p className="text-[10px] text-prose-faint font-mono truncate" title={link.href}>{link.href}</p>
    </div>
  )
}
