'use client'

// Client-side accept handler — calls the Server Action and redirects on
// success. Lives next to the public accept page rather than under the
// generic _components/ folder since it's tightly bound to that route.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvite } from '@/lib/dad-tools/savings-actions'

export default function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onAccept() {
    setError(null)
    startTransition(async () => {
      const result = await acceptInvite({ token })
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (result.data?.goalId) {
        router.push(`/tools/savings/${result.data.goalId}`)
      } else {
        router.push('/tools/savings')
      }
    })
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onAccept}
        disabled={pending}
        className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
      >
        {pending ? 'Joining…' : 'Join the goal →'}
      </button>
      {error && (
        <div className="bg-danger-bg border border-danger-line text-danger-ink rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
