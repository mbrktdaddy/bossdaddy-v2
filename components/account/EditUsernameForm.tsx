'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/lib/profile-actions'
import { buttonVariants } from '@/components/ui/Button'
import { fieldClass } from '@/components/ui/Field'

export default function EditUsernameForm({ current }: { current: string }) {
  const router = useRouter()
  const [username, setUsername] = useState(current)
  const [pending, startTransition] = useTransition()
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (username.trim() === current) return
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await updateProfile({ username: username.trim() })
      if (!result.ok) { setError(result.error); return }
      setSuccess(true)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="username-field" className="block mb-1.5 text-sm font-semibold text-prose">
          Username
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-prose-faint text-base sm:text-sm select-none">@</span>
            <input
              id="username-field"
              aria-describedby="username-hint"
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setSuccess(false); setError(null) }}
              maxLength={20}
              className={fieldClass({ className: 'pl-7' })}
            />
          </div>
          <button
            type="submit"
            disabled={pending || username.trim() === current || username.trim().length < 3}
            className={buttonVariants({ className: 'shrink-0' })}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p id="username-hint" className="text-xs text-prose-muted mt-1.5">3–20 characters, letters, numbers, and underscores only.</p>
      </div>
      {success && <p role="status" className="text-success-ink text-sm">Username updated successfully.</p>}
      {error && <p role="alert" className="text-danger-ink text-sm font-medium">{error}</p>}
    </form>
  )
}
