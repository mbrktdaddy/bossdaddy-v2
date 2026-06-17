'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Citation } from '@/lib/boss/types'

// The gap-fallback shortlist. Deliberately LIGHTER than RecommendationCard (the
// rich, bordered card used for real Boss-tested reviews) — researched picks get
// a lean list so the visual weight itself signals "this is research, not a Boss
// verdict." One group container carries the eyebrow, FTC line, and a single
// notify capture; the per-pick rows stay compact. Every row's data + sources
// came from research_gear's sourced web search.
const TIER_LABEL: Record<string, string> = { budget: 'Budget', mid: 'Mid', premium: 'Premium' }

function priceLabel(c: Citation): string | null {
  const tier = c.priceTier ? TIER_LABEL[c.priceTier] : null
  if (tier && c.priceText) return `${tier} · ${c.priceText}`
  return tier ?? c.priceText ?? null
}

export function ResearchedList({ items, query }: { items: Citation[]; query?: string }) {
  if (!items.length) return null
  const hasBuy = items.some((c) => c.buyUrl)

  return (
    <div className="border border-soft rounded-xl bg-surface p-3">
      <div className="text-[10px] uppercase tracking-widest text-eyebrow mb-1.5">Researched · not tested</div>

      <ul className="divide-y divide-soft">
        {items.map((c) => {
          const price = priceLabel(c)
          return (
            <li key={`${c.kind}:${c.slug}`} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-prose leading-snug">{c.title}</span>
                {price && <span className="text-[11px] text-prose-faint shrink-0">{price}</span>}
              </div>
              {c.fit && <p className="mt-0.5 text-[13px] text-prose-muted leading-snug">{c.fit}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                {c.buyUrl && (
                  <Link
                    href={c.buyUrl}
                    target="_blank"
                    rel="sponsored nofollow noopener"
                    className="inline-flex items-center font-semibold text-accent hover:underline py-1"
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
                    className="text-[11px] text-prose-faint hover:text-accent hover:underline truncate max-w-[9rem] py-1"
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

      <div className="mt-2 pt-2 border-t border-soft flex flex-wrap items-center gap-x-4 gap-y-2">
        <ResearchedNotify query={query} />
        <Link href="/bench" className="text-[12px] font-semibold text-accent hover:underline">
          Vote onto the bench →
        </Link>
      </div>
    </div>
  )
}

// A single "notify me when the Boss tests one" capture for the whole shortlist —
// rendered once (not per pick). Stores the topic (the user's query) so the admin
// batch knows what was asked for.
function ResearchedNotify({ query }: { query?: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  async function notify(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || state === 'busy') return
    setState('busy')
    try {
      const res = await fetch('/api/boss/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), query: query?.slice(0, 500) }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return <p className="text-[12px] text-prose-muted">Got it — the Boss will ping you when one of these hits the bench.</p>
  }

  return (
    <form onSubmit={notify} className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] text-prose-muted">Want the Boss to test one?</span>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        className="flex-1 min-w-[9rem] bg-surface-raised border border-soft rounded-lg px-2.5 py-2 text-[13px] text-prose placeholder:text-prose-faint focus:outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={state === 'busy' || !email.trim()}
        className="text-[13px] font-semibold text-white bg-accent hover:bg-accent-hover disabled:opacity-40 rounded-lg px-3 py-2 min-h-[40px] transition-colors"
      >
        {state === 'busy' ? '…' : 'Notify me'}
      </button>
      {state === 'error' && <span className="text-[11px] text-danger-ink">Couldn’t save — try again.</span>}
    </form>
  )
}
