'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { LoginPromptModal } from './LoginPromptModal'
import { loadVoteState } from './vote-state'
import { requestedByLabel } from '@/lib/wishlist'

interface Props {
  itemId: string
  /** Public vote count from the static render. Paints instantly, then the
   *  batched client read reconciles it with the live count. */
  initialCount: number
}

// "Want me to test it?" — the vote on a live Radar card. Voting lives here, not
// on the Bench (whose one job is follow); the API refuses new votes on anything
// that isn't live on Radar. Votes carry over when the item moves to the Bench.
//
// A vote also FOLLOWS the item (lib/wishlist.ts followChangeForVote), so the
// voter gets the follower emails. The card says so the moment they vote, and
// the same tap undoes both while the item is still on the Radar.
export function RadarVote({ itemId, initialCount }: Props) {
  const pathname = usePathname()
  const [voted, setVoted]         = useState(false)
  const [following, setFollowing] = useState(false)
  const [count, setCount]         = useState(initialCount)
  const [loading, setLoading]     = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Per-user vote state lives client-side so the page can be statically
  // cached. loadVoteState batches every card's read into one request.
  useEffect(() => {
    let current = true
    loadVoteState(itemId).then((state) => {
      if (!current || !state) return
      setVoted(state.voted)
      setFollowing(state.following)
      setCount(state.vote_count)
    })
    return () => { current = false }
  }, [itemId])

  async function handleClick() {
    setError(null)
    const prevVoted = voted
    const prevFollowing = following
    const prevCount = count
    setVoted(!voted)
    setFollowing(!voted)
    setCount((c) => c + (voted ? -1 : 1))
    setLoading(true)
    const res = await fetch(`/api/wishlist/${itemId}/vote`, { method: 'POST' })
    if (res.ok) {
      const json = await res.json()
      setVoted(json.voted)
      setFollowing(!!json.following)
      setCount(json.vote_count)
    } else {
      setVoted(prevVoted)
      setFollowing(prevFollowing)
      setCount(prevCount)
      if (res.status === 401) {
        setShowModal(true)
      } else {
        // 409 = the item moved on since the page was cached; the API says so.
        const json = await res.json().catch(() => null)
        setError(res.status === 409 && json?.error ? json.error : 'Could not save your vote. Try again.')
      }
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-prose">Want me to test it?</p>
          {/* One short line in every state, so voting doesn't shift the card.
              Once voted, it states the follow the vote created (guardrail:
              say it when they vote), but only while the follow really exists. */}
          <p className="text-xs text-prose-faint tabular-nums" aria-live="polite">
            {voted && following
              ? "I'll email you when I test it."
              : count > 0 ? requestedByLabel(count) : 'Be the first to ask.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className={`shrink-0 min-w-[7.5rem] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 ${
            voted
              ? 'bg-accent-tint border-accent-border text-accent-text-soft'
              : 'bg-surface border-strong text-prose-muted hover:border-accent-border hover:text-accent-text-soft'
          }`}
        >
          <svg className="w-4 h-4" fill={voted ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
          <span>{voted ? 'Requested' : 'Test it'}</span>
        </button>
      </div>

      {error && <p role="alert" className="mt-1.5 text-xs text-danger-ink">{error}</p>}

      {showModal && (
        <LoginPromptModal
          intent="vote"
          onClose={() => setShowModal(false)}
          returnPath={pathname}
        />
      )}
    </div>
  )
}
