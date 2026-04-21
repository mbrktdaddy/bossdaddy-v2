'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function EditEmailForm({ current }: { current: string }) {
  const [editing, setEditing]   = useState(false)
  const [email, setEmail]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || trimmed === current) return
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ email: trimmed })

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    setSent(true)
    setSaving(false)
  }

  if (sent) {
    return (
      <div className="bg-green-950/30 border border-green-900/40 rounded-xl p-4">
        <p className="text-green-400 text-sm font-semibold mb-1">Confirmation sent</p>
        <p className="text-gray-400 text-sm">
          Check <span className="text-white">{email.trim()}</span> for a confirmation link.
          Your email won't change until you click it.
        </p>
        <button
          onClick={() => { setSent(false); setEditing(false); setEmail('') }}
          className="text-xs text-gray-500 hover:text-gray-300 mt-3 transition-colors"
        >
          Done
        </button>
      </div>
    )
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-gray-400">{current}</p>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-orange-400 hover:text-orange-300 transition-colors shrink-0"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={e => { setEmail(e.target.value); setError(null) }}
        placeholder="New email address"
        required
        className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 focus:border-orange-500 rounded-xl text-white text-sm focus:outline-none transition-colors placeholder-gray-600"
      />
      <p className="text-xs text-gray-600">
        A confirmation link will be sent to your new address. Your email won't change until you confirm.
      </p>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !email.trim() || email.trim() === current}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? 'Sending…' : 'Send Confirmation'}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setEmail(''); setError(null) }}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
