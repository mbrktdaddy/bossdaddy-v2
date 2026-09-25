'use client'

// Client-side accept handler — calls the Server Action and redirects on
// success. Lives next to the public accept page rather than under the
// generic _components/ folder since it's tightly bound to that route.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvite } from '@/lib/dad-tools/savings-actions'
import { buttonVariants } from '@/components/ui/Button'

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
        className={buttonVariants()}
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
