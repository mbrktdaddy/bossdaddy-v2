'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '../actions'

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

  const saving = pending

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
          Username
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm select-none">@</span>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setSuccess(false); setError(null) }}
              maxLength={20}
              className="w-full pl-7 pr-3 py-2.5 bg-gray-950 border border-gray-700 focus:border-orange-500 rounded-xl text-white text-sm focus:outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={saving || username.trim() === current || username.trim().length < 3}
            className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-1.5">3–20 characters, letters, numbers, and underscores only.</p>
      </div>

      {success && (
        <p className="text-green-400 text-xs">Username updated successfully.</p>
      )}
      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}
    </form>
  )
}
