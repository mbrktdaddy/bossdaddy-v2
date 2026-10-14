'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Notice } from '@/components/ui/Notice'

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

  // The shared Notice (continuity plan P17) — the old peach accent-tint box is
  // gone. The leading check icon went with it: the title already says "reviewed",
  // and Notice has no icon slot on purpose (one recipe, no per-surface variants).
  return (
    <Notice variant="inline" className="mb-8" title="You voted for this — it’s reviewed." onDismiss={dismiss}>
      <Link
        href={`/reviews/${lead.reviewSlug}`}
        className="font-semibold text-prose underline decoration-accent underline-offset-2 hover:text-accent-text"
      >
        {lead.title}
      </Link>{' '}
      is off the bench and fully tested.
      {extra > 0 && (
        <>
          {' '}
          <Link href="/reviews" className="font-semibold text-prose hover:text-accent-text">
            +{extra} more you voted for →
          </Link>
        </>
      )}
    </Notice>
  )
}
