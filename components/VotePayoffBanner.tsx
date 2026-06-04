'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface GradVote {
  reviewSlug: string
  reviewTitle: string
  title: string
}

const DISMISS_KEY = 'bd_vote_payoff_dismissed'

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Personalized loop-closure payoff: when a member voted for a bench item that
// has since become a published review, tell them. Fetched client-side (same
// pattern as VoteButton) so the host page stays statically cached. Dismissed
// slugs persist in localStorage so it doesn't nag after they've seen it.
export function VotePayoffBanner() {
  const [items, setItems] = useState<GradVote[]>([])

  useEffect(() => {
    fetch('/api/wishlist/my-graduated-votes')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then(({ items }) => {
        if (!Array.isArray(items) || items.length === 0) return
        const dismissed = readDismissed()
        setItems(items.filter((i: GradVote) => !dismissed.includes(i.reviewSlug)))
      })
      .catch(() => {})
  }, [])

  if (items.length === 0) return null

  const lead = items[0]
  const extra = items.length - 1

  function dismiss() {
    try {
      const prev = readDismissed()
      const next = [...new Set([...prev, ...items.map((i) => i.reviewSlug)])]
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
    setItems([])
  }

  return (
    <div className="mb-8 flex items-start gap-3 rounded-xl bg-accent-tint border border-accent-border/50 p-4 shadow-md shadow-black/5">
      <span className="mt-0.5 shrink-0 text-accent-text-soft" aria-hidden>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-accent-text/90">
          <strong className="text-accent-text-soft">You voted for this — it&apos;s reviewed.</strong>{' '}
          <Link
            href={`/reviews/${lead.reviewSlug}`}
            className="font-semibold underline decoration-accent-border/60 underline-offset-2 hover:text-accent-text-soft"
          >
            {lead.title}
          </Link>{' '}
          is off the bench and fully tested.
          {extra > 0 && (
            <>
              {' '}
              <Link href="/reviews" className="font-semibold hover:text-accent-text-soft">
                +{extra} more you voted for →
              </Link>
            </>
          )}
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 -mt-1 -mr-1 p-1 text-accent-text/50 hover:text-accent-text-soft transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
