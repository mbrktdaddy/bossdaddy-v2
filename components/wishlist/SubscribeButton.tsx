'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { LoginPromptModal } from './LoginPromptModal'

interface Props {
  itemId: string
  initialSubscribed: boolean
  isAuthenticated: boolean
}

export function SubscribeButton({ itemId, initialSubscribed, isAuthenticated }: Props) {
  const pathname = usePathname()
  const [subscribed, setSubscribed] = useState(initialSubscribed)
  const [loading, setLoading]       = useState(false)
  const [showModal, setShowModal]   = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleClick() {
    if (!isAuthenticated) { setShowModal(true); return }
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/wishlist/${itemId}/subscribe`, { method: 'POST' })
    if (res.ok) {
      const json = await res.json()
      setSubscribed(json.subscribed)
    } else {
      setError('Could not update subscription. Try again.')
    }
    setLoading(false)
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all disabled:opacity-50 ${
          subscribed
            ? 'bg-blue-950/40 border-blue-700 text-blue-400'
            : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-blue-700 hover:text-blue-400'
        }`}
      >
        <svg className="w-4 h-4" fill={subscribed ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span>{subscribed ? 'Notifying me' : 'Notify me'}</span>
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
