'use client'

import { useState } from 'react'
import type { SpecsGradeData } from '@/lib/reviews'

interface Props {
  productName: string
  category: string
  /** Linked catalog product — the endpoint loads its brand + specs server-side. */
  productSlug: string | null
  /** Author-curated rivals (the comparison picker) — steer the search. */
  competitorSlugs: string[]
  score: number | null
  rationale: string
  data: SpecsGradeData
  onScore: (n: number | null) => void
  onRationale: (s: string) => void
  onData: (d: SpecsGradeData) => void
  /**
   * Optional — when present, shows a "Weave into review" action that drops a
   * ready-made refine instruction (grade + rationale + rivals) into the AI
   * Refine box. Omitted when there's no body content to refine yet.
   */
  onWeave?: () => void
}

/**
 * AI Specs Grade — the optional 5th rating axis. "Grade specs with AI" runs a
 * web-grounded comparison against similar models and proposes a 1-10 grade +
 * rationale + the sources it used. The author reviews, can override the number
 * or edit the rationale, and it folds into the overall (present-only average).
 * Distinct from Quality: Quality = hands-on build; Specs = measurable
 * capabilities vs the field.
 */
export function SpecsGradePanel({
  productName, category, productSlug, competitorSlugs,
  score, rationale, data, onScore, onRationale, onData, onWeave,
}: Props) {
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [abstainNote, setAbstainNote] = useState<string | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)

  const canGrade = productName.trim().length >= 2 && !!category

  async function handleGrade() {
    if (!canGrade || loading) return
    setLoading(true); setError(null); setAbstainNote(null)
    try {
      const res = await fetch('/api/claude/specs-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          category,
          ...(productSlug ? { productSlug } : {}),
          ...(competitorSlugs.length ? { competitorSlugs } : {}),
        }),
      })

      // The grade can run ~1–2 min of web search. If it times out or crashes at
      // the platform level, Vercel returns a non-JSON error page — read as text
      // and parse defensively so the author gets a clear message, not a raw
      // "Unexpected token" JSON error.
      const raw = await res.text()
      let json: { error?: string; grade?: unknown; abstained?: boolean; rationale?: unknown; comparedAgainst?: unknown; sources?: unknown } | null = null
      try { json = raw ? JSON.parse(raw) : null } catch { /* non-JSON platform error */ }

      if (!res.ok || !json) {
        const reason = json?.error
          ?? (res.status === 504 || res.status === 408
                ? 'The web search took too long and timed out — try again, it usually works on a second run.'
                : res.status >= 500
                ? `The grader hit a server error (${res.status}) — try again in a moment.`
                : `Grading failed (${res.status}).`)
        throw new Error(reason)
      }

      const nextData: SpecsGradeData = {
        comparedAgainst: Array.isArray(json.comparedAgainst) ? json.comparedAgainst : [],
        sources:         Array.isArray(json.sources) ? json.sources : [],
        gradedAt:        new Date().toISOString(),
      }
      onData(nextData)
      onRationale(typeof json.rationale === 'string' ? json.rationale : '')

      if (json.abstained || typeof json.grade !== 'number') {
        onScore(null)
        setAbstainNote((typeof json.rationale === 'string' && json.rationale) || 'Not enough reliable data to grade these specs.')
      } else {
        onScore(json.grade)
        if (nextData.comparedAgainst.length || nextData.sources.length) setSourcesOpen(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grading failed')
    } finally {
      setLoading(false)
    }
  }

  function clearGrade() {
    onScore(null); onRationale(''); onData({ comparedAgainst: [], sources: [] }); setAbstainNote(null)
  }

  const hasResult = score != null || rationale.trim() || data.comparedAgainst.length > 0

  return (
    <div className="bg-surface border border-soft rounded-xl p-4">
      <div className="flex items-center justify-between mb-1 gap-3">
        <p className="text-sm font-semibold text-prose flex items-center gap-2">
          <span className="text-accent-text-soft">⚖</span> Specs Grade
        </p>
        {hasResult && (
          <button onClick={clearGrade} className="text-xs text-prose-faint hover:text-red-700 transition-colors shrink-0">
            Clear
          </button>
        )}
      </div>
      <p className="text-xs text-prose-faint mb-3">
        Optional 5th axis — how the measurable specs rank vs similar models (web-sourced, AI-graded). Folds into the overall. Distinct from Quality (hands-on build).
      </p>

      <button
        onClick={handleGrade}
        disabled={!canGrade || loading}
        className="w-full px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors min-h-[44px]"
      >
        {loading ? 'Searching the web…' : score != null || abstainNote ? 'Re-grade with AI' : 'Grade specs with AI'}
      </button>
      {loading && (
        <p className="mt-2 text-xs text-prose-faint">Comparing against similar models — this can take up to a minute.</p>
      )}
      {!canGrade && (
        <p className="mt-2 text-xs text-prose-faint">Set a product name and category first.</p>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2">{error}</p>
      )}
      {abstainNote && score == null && (
        <p className="mt-2 text-xs text-warn-ink bg-surface-sunken border border-soft rounded px-3 py-2">
          <span className="font-semibold">Not graded:</span> {abstainNote}
        </p>
      )}

      {(score != null || rationale.trim()) && (
        <div className="mt-3 space-y-3 border-t border-soft pt-3">
          {/* Editable grade */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="text-xs font-medium text-prose-muted">Grade</label>
            <select
              value={score ?? ''}
              onChange={(e) => onScore(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="px-3 py-2 bg-surface-sunken border border-strong rounded-lg text-sm text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
            >
              <option value="">— not graded —</option>
              {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}/10</option>)}
            </select>
            <span className="text-xs text-prose-faint">you can override the AI</span>
          </div>

          {/* Editable rationale */}
          <div>
            <label className="block text-xs font-medium text-prose-muted mb-1">Rationale <span className="text-prose-faint">(shown to readers)</span></label>
            <textarea
              value={rationale}
              onChange={(e) => onRationale(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full px-3 py-2 bg-surface-sunken border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
            />
          </div>

          {/* One-click: drop a ready-made refine instruction into AI Refine so
              the prose can reference the comparison (author reviews the diff). */}
          {onWeave && score != null && (
            <button
              type="button"
              onClick={onWeave}
              title="Pre-fills the AI Refine box with this grade's comparison — you click Apply and review the change"
              className="w-full px-4 py-2.5 bg-surface-raised hover:bg-surface border border-accent-border/40 text-prose-muted hover:text-prose text-sm font-semibold rounded-lg transition-colors"
            >
              Weave into review →
            </button>
          )}

          {/* Read-only: what it compared against + sources */}
          {(data.comparedAgainst.length > 0 || data.sources.length > 0) && (
            <details open={sourcesOpen} className="text-xs">
              <summary className="cursor-pointer text-prose-muted hover:text-prose font-medium">
                Compared against {data.comparedAgainst.length} model{data.comparedAgainst.length === 1 ? '' : 's'} · {data.sources.length} source{data.sources.length === 1 ? '' : 's'}
              </summary>
              <div className="mt-2 space-y-2">
                {data.comparedAgainst.map((c, i) => (
                  <div key={i} className="bg-surface-sunken border border-soft rounded-lg p-2">
                    <p className="font-semibold text-prose">{c.brand ? `${c.brand} · ` : ''}{c.name}</p>
                    {c.keySpecs.length > 0 && (
                      <p className="text-prose-faint mt-0.5">{c.keySpecs.map((s) => `${s.label}: ${s.value}`).join(' · ')}</p>
                    )}
                  </div>
                ))}
                {data.sources.length > 0 && (
                  <ul className="space-y-1">
                    {data.sources.map((s, i) => (
                      <li key={i} className="truncate">
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent-text-soft hover:text-accent">{s.title}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
