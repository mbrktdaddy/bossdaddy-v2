'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import type { ProductBlock } from '@/lib/boss/types'
import { Card } from '@/components/ui/Card'
import { buttonVariants } from '@/components/ui/Button'
import { fieldClass } from '@/components/ui/Field'
import { CheckCircleIcon } from '@/components/icons'
import { LABELS } from '@/lib/labels'

// The gap-fallback shortlist. Deliberately LIGHTER than RecommendationCard (the
// rich, bordered card used for real Boss-tested reviews) — researched picks get
// a lean list so the visual weight itself signals "this is research, not a Boss
// verdict." One group container carries the eyebrow, FTC line, and a single
// notify capture; the per-pick rows stay compact. Every row's data + sources
// came from research_gear's sourced web search.
const TIER_LABEL: Record<string, string> = { budget: 'Budget', mid: 'Mid', premium: 'Premium' }

function priceLabel(c: ProductBlock): string | null {
  const tier = c.priceTier ? TIER_LABEL[c.priceTier] : null
  if (tier && c.priceText) return `${tier} · ${c.priceText}`
  return tier ?? c.priceText ?? null
}

export function ResearchedList({ items, query }: { items: ProductBlock[]; query?: string }) {
  if (!items.length) return null
  const hasBuy = items.some((c) => c.buyUrl)

  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-widest text-eyebrow mb-1.5">Researched · not tested</div>

      <ul className="divide-y divide-soft">
        {items.map((c) => {
          const price = priceLabel(c)
          return (
            <li key={`${c.kind}:${c.slug}`} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-extrabold text-prose leading-snug">{c.title}</span>
                {price && <span className="text-[11px] text-prose-faint shrink-0">{price}</span>}
              </div>
              {c.fit && <p className="mt-0.5 text-[13px] text-prose-muted leading-snug">{c.fit}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                {c.buyUrl && (
                  <Link
                    href={c.buyUrl}
                    target="_blank"
                    rel="sponsored nofollow noopener"
                    className="inline-flex items-center font-semibold text-accent-text hover:underline underline-offset-2 py-1"
                  >
                    Check price →
                  </Link>
                )}
                {c.sources?.slice(0, 3).map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-prose-faint hover:text-accent-text hover:underline truncate max-w-[9rem] py-1"
                  >
                    {s.title}
                  </a>
                ))}
              </div>
            </li>
          )
        })}
      </ul>

      <p className="mt-2 text-[11px] text-prose-faint">
        {hasBuy ? 'Affiliate links may earn a commission at no cost to you. ' : ''}Not tested by the Boss — researched from the sources above.
      </p>

      <div className="mt-2 pt-2 border-t border-soft">
        <ResearchedNotify query={query} />
        {/* Voting happens on the Radar ("Want me to test it?"), not the Bench. */}
        <Link href="/gear/radar" className="inline-flex items-center min-h-[44px] text-[12px] font-semibold text-accent-text hover:underline underline-offset-2">
          Vote on what gets tested next →
        </Link>
      </div>
    </Card>
  )
}

// A single "notify me when the Boss tests one" capture for the whole shortlist —
// rendered once (not per pick). Stores the topic (the user's query) so the admin
// batch knows what was asked for. Keeps its own endpoint (a different list from
// the newsletter) but wears the newsletter's inline look (continuity plan P11):
// a real <label>, a 16px/44px field, the error line always mounted, and the
// form + its confirmation sharing one grid cell so submitting never changes the
// height of the chat bubble it sits in.
function ResearchedNotify({ query }: { query?: string }) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState('')
  const done = state === 'done'

  async function notify(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || state === 'busy') return
    setState('busy')
    setError('')
    try {
      const res = await fetch('/api/boss/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), query: query?.slice(0, 500) }),
      })
      if (res.ok) { setState('done'); return }
      // The route answers { error } for a bad email, a rate limit, or a DB failure.
      const body = await res.json().catch(() => null) as { error?: string } | null
      setError(body?.error ?? 'Couldn’t save that. Try again in a minute.')
    } catch {
      setError('Couldn’t save that. Try again in a minute.')
    }
    setState('idle')
  }

  return (
    <div>
      <div className="grid">
        <form
          onSubmit={notify}
          inert={done}
          aria-hidden={done || undefined}
          className={`[grid-area:1/1] flex flex-wrap items-center gap-2 ${done ? 'invisible' : ''}`}
        >
          <label htmlFor={inputId} className="basis-full text-[12px] text-prose-muted">Want the Boss to test one?</label>
          <input
            id={inputId}
            autoComplete="email"
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError('') }}
            placeholder={LABELS.newsletter.placeholder}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            className={fieldClass({ className: 'flex-1 min-w-0 basis-48' })}
          />
          <button type="submit" disabled={state === 'busy'} className={buttonVariants({ className: 'basis-full sm:basis-auto' })}>
            {state === 'busy' ? LABELS.newsletter.submitting : LABELS.newsletter.notify}
          </button>
        </form>
        <p role="status" className="[grid-area:1/1] self-center flex items-center gap-2 text-[13px] font-semibold text-prose">
          {done && (
            <>
              <CheckCircleIcon className="w-5 h-5 shrink-0 text-success-ink" strokeWidth={2} />
              Got it — the Boss will ping you when one of these hits the bench.
            </>
          )}
        </p>
      </div>
      {/* Always mounted, one line reserved — an error must not push the chat down. */}
      <p id={errorId} role="alert" className="min-h-5 mt-1 text-xs font-semibold leading-5 text-danger-ink">
        {error}
      </p>
    </div>
  )
}
