'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { LoginPromptModal } from './LoginPromptModal'
import { buttonVariants } from '@/components/ui/Button'

interface Props {
  itemId: string
}

export function SubscribeButton({ itemId }: Props) {
  const pathname = usePathname()
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [showModal, setShowModal]   = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Per-user subscription state lives client-side (same pattern as LikeButton)
  // so the bench page can be statically cached.
  useEffect(() => {
    fetch(`/api/wishlist/${itemId}/subscribe`)
      .then((r) => r.json())
      .then(({ subscribed }) => setSubscribed(!!subscribed))
      .catch(() => {})
  }, [itemId])

  async function handleClick() {
    setError(null)
    const prevSubscribed = subscribed
    setSubscribed(!subscribed)
    setLoading(true)
    try {
      const res = await fetch(`/api/wishlist/${itemId}/subscribe`, { method: 'POST' })
      if (res.ok) {
        const json = await res.json()
        setSubscribed(json.subscribed)
      } else if (res.status === 401) {
        setSubscribed(prevSubscribed)
        setShowModal(true)
      } else {
        setSubscribed(prevSubscribed)
        setError('Could not update subscription. Try again.')
      }
    } catch {
      // Offline / dropped request: revert the optimistic flip AND say so.
      setSubscribed(prevSubscribed)
      setError('Could not update subscription. Try again.')
    }
    setLoading(false)
  }

  // Follow is the Bench's one job (votes live on the Radar). Followers get an
  // email when testing starts and when the review is approved —
  // lib/wishlist-emails.ts.
  //
  // Off = the outline; on = the success recipe. Both carry the same 2px border
  // and the same size (buttonVariants guarantees it), so the toggle changes
  // colour and nothing else. The error sits in the wrapper BELOW the button —
  // this lives in a flex row on the Bench page, where a bare sibling <p> would
  // become a third item beside the buy link.
  return (
    <>
      <div>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className={buttonVariants({ variant: subscribed ? 'success' : 'outline' })}
        >
          <svg className="w-4 h-4 shrink-0" fill={subscribed ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span>{subscribed ? "You're on the list" : "Notify me when the review's out"}</span>
        </button>

        {error && <p role="alert" className="mt-1.5 text-xs font-semibold text-danger-ink">{error}</p>}
      </div>

      {showModal && (
        <LoginPromptModal
          intent="follow"
          onClose={() => setShowModal(false)}
          returnPath={pathname}
        />
      )}
    </>
  )
}
