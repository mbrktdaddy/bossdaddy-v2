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
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/wishlist/${itemId}/vote`, { method: 'POST' })
    if (res.ok) {
      const json = await res.json()
      setVoted(json.voted)
      setCount(json.vote_count)
    } else {
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
            ? 'bg-orange-950/50 border-orange-700 text-orange-400'
            : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-orange-700 hover:text-orange-400'
        }`}
      >
        <svg className="w-4 h-4" fill={voted ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
        <span>{count > 0 ? count : ''} {voted ? 'Voted' : 'Vote'}</span>
      </button>

      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}

      {showModal && (
        <LoginPromptModal
          onClose={() => setShowModal(false)}
          returnPath={pathname}
        />
      )}
    </>
  )
}
