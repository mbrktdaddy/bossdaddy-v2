'use client'

// Public author identity editor (display name / tagline / bio) — feeds the
// /author/[username] page. Shown on /account/settings for authors + admins;
// members don't have a public author page so they never see it.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/lib/profile-actions'
import { buttonVariants } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'

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
      <Field
        label="Display name"
        type="text"
        value={displayName}
        maxLength={60}
        onChange={(e) => { setDisplayName(e.target.value); setSuccess(false); setError(null) }}
        placeholder="Boss Daddy"
        hint="How your name appears on guides + reviews."
      />

      <Field
        label="Tagline"
        type="text"
        value={tagline}
        maxLength={120}
        onChange={(e) => { setTagline(e.target.value); setSuccess(false); setError(null) }}
        placeholder="First-time dad. Honest gear reviews."
        hint={<>Short one-liner shown under your name. {tagline.length}/120</>}
      />

      <Field
        as="textarea"
        label="Bio"
        value={bio}
        rows={4}
        maxLength={800}
        onChange={(e) => { setBio(e.target.value); setSuccess(false); setError(null) }}
        placeholder="A few sentences about who you are, what you test, and why your perspective matters."
        controlClassName="resize-none"
        hint={<>Shown at the bottom of every guide + review you publish. {bio.length}/800</>}
      />

      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="text-sm">
          {error   && <p role="alert" className="font-medium text-danger-ink">{error}</p>}
          {success && <p className="text-success-ink">✓ Saved</p>}
        </div>
        <button
          type="submit"
          disabled={saving}
          className={buttonVariants({ className: 'shrink-0' })}
        >
          {saving ? 'Saving…' : 'Save bio'}
        </button>
      </div>
    </form>
  )
}
