'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { LoginPromptModal } from './LoginPromptModal'

interface Props {
  itemId: string
  initialVoted: boolean
  initialCount: number
  isAuthenticated: boolean
}

export function VoteButton({ itemId, initialVoted, initialCount, isAuthenticated }: Props) {
  const pathname = usePathname()
  const [voted, setVoted]       = useState(initialVoted)
  const [count, setCount]       = useState(initialCount)
  const [loading, setLoading]   = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleClick() {
    if (!isAuthenticated) { setShowModal(true); return }
    setError(null)
    const prevVoted = voted
    const prevCount = count
    setVoted(!voted)
    setCount((c) => c + (voted ? -1 : 1))
    setLoading(true)
    const res = await fetch(`/api/wishlist/${itemId}/vote`, { method: 'POST' })
    if (res.ok) {
      const json = await res.json()
      setVoted(json.voted)
      setCount(json.vote_count)
    } else {
      setVoted(prevVoted)
      setCount(prevCount)
      setError('Could not save your vote. Try again.')
    }
    setLoading(false)
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all disabled:opacity-50 ${
          voted
            ? 'bg-accent-tint border-accent-border text-accent-text-soft'
            : 'bg-surface border-strong text-prose-muted hover:border-accent-border hover:text-accent-text-soft'
        }`}
      >
        <svg className="w-4 h-4" fill={voted ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
        <span>{count > 0 ? count : ''} {voted ? 'Voted' : 'Vote'}</span>
      </button>

      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}

      {showModal && (
        <LoginPromptModal
          onClose={() => setShowModal(false)}
          returnPath={pathname}
        />
      )}
    </>
  )
}
