'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '../actions'

interface Props {
  initialDisplayName: string | null
  initialTagline:     string | null
  initialBio:         string | null
}

export default function BioForm({
  initialDisplayName,
  initialTagline,
  initialBio,
}: Props) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '')
  const [tagline,     setTagline]     = useState(initialTagline ?? '')
  const [bio,         setBio]         = useState(initialBio ?? '')
  const [pending,     startTransition] = useTransition()
  const [success,     setSuccess]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSuccess(false)
    startTransition(async () => {
      const result = await updateProfile({
        display_name: displayName.trim() || null,
        tagline:      tagline.trim()     || null,
        bio:          bio.trim()         || null,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSuccess(true)
      router.refresh()
    })
  }

  const saving = pending

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-prose-faint uppercase tracking-widest mb-2">Display name</label>
        <input
          type="text"
          value={displayName}
          maxLength={60}
          onChange={(e) => { setDisplayName(e.target.value); setSuccess(false); setError(null) }}
          placeholder="Boss Daddy"
          className="w-full px-3 py-2.5 bg-surface-sunken border border-strong focus:border-accent rounded-xl text-prose text-sm placeholder:text-prose-faint focus:outline-none transition-colors"
        />
        <p className="mt-1 text-xs text-prose-faint">How your name appears on guides + reviews.</p>
      </div>

      <div>
        <label className="block text-xs text-prose-faint uppercase tracking-widest mb-2">Tagline</label>
        <input
          type="text"
          value={tagline}
          maxLength={120}
          onChange={(e) => { setTagline(e.target.value); setSuccess(false); setError(null) }}
          placeholder="First-time dad. Honest gear reviews."
          className="w-full px-3 py-2.5 bg-surface-sunken border border-strong focus:border-accent rounded-xl text-prose text-sm placeholder:text-prose-faint focus:outline-none transition-colors"
        />
        <p className="mt-1 text-xs text-prose-faint">Short one-liner shown under your name. {tagline.length}/120</p>
      </div>

      <div>
        <label className="block text-xs text-prose-faint uppercase tracking-widest mb-2">Bio</label>
        <textarea
          value={bio}
          rows={4}
          maxLength={800}
          onChange={(e) => { setBio(e.target.value); setSuccess(false); setError(null) }}
          placeholder="A few sentences about who you are, what you test, and why your perspective matters."
          className="w-full px-3 py-2.5 bg-surface-sunken border border-strong focus:border-accent rounded-xl text-prose text-sm placeholder:text-prose-faint focus:outline-none transition-colors resize-none"
        />
        <p className="mt-1 text-xs text-prose-faint">Shown at the bottom of every guide + review you publish. {bio.length}/800</p>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="text-sm">
          {error   && <p className="text-red-700">{error}</p>}
          {success && <p className="text-forest">✓ Saved</p>}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
        >
          {saving ? 'Saving…' : 'Save bio'}
        </button>
      </div>
    </form>
  )
}
