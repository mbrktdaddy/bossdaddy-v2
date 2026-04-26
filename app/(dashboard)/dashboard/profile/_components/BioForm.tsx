'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  initialDisplayName: string | null
  initialTagline:     string | null
  initialBio:         string | null
  initialAvatarUrl:   string | null
}

export default function BioForm({
  initialDisplayName,
  initialTagline,
  initialBio,
  initialAvatarUrl,
}: Props) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '')
  const [tagline,     setTagline]     = useState(initialTagline ?? '')
  const [bio,         setBio]         = useState(initialBio ?? '')
  const [avatarUrl,   setAvatarUrl]   = useState(initialAvatarUrl ?? '')
  const [saving,      setSaving]      = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null); setSuccess(false)

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          tagline:      tagline.trim()     || null,
          bio:          bio.trim()         || null,
          avatar_url:   avatarUrl.trim()   || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Save failed')
        setSaving(false)
        return
      }
      setSuccess(true)
      setSaving(false)
      router.refresh()
    } catch {
      setError('Could not reach the server. Try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Display name</label>
        <input
          type="text"
          value={displayName}
          maxLength={60}
          onChange={(e) => { setDisplayName(e.target.value); setSuccess(false); setError(null) }}
          placeholder="Boss Daddy"
          className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 focus:border-orange-500 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none transition-colors"
        />
        <p className="mt-1 text-xs text-gray-600">How your name appears on articles + reviews.</p>
      </div>

      <div>
        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Tagline</label>
        <input
          type="text"
          value={tagline}
          maxLength={120}
          onChange={(e) => { setTagline(e.target.value); setSuccess(false); setError(null) }}
          placeholder="First-time dad. Honest gear reviews."
          className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 focus:border-orange-500 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none transition-colors"
        />
        <p className="mt-1 text-xs text-gray-600">Short one-liner shown under your name. {tagline.length}/120</p>
      </div>

      <div>
        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Bio</label>
        <textarea
          value={bio}
          rows={4}
          maxLength={800}
          onChange={(e) => { setBio(e.target.value); setSuccess(false); setError(null) }}
          placeholder="A few sentences about who you are, what you test, and why your perspective matters."
          className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 focus:border-orange-500 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none transition-colors resize-none"
        />
        <p className="mt-1 text-xs text-gray-600">Shown at the bottom of every article + review you publish. {bio.length}/800</p>
      </div>

      <div>
        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Avatar URL</label>
        <input
          type="url"
          value={avatarUrl}
          maxLength={2048}
          onChange={(e) => { setAvatarUrl(e.target.value); setSuccess(false); setError(null) }}
          placeholder="https://..."
          className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 focus:border-orange-500 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none transition-colors"
        />
        <p className="mt-1 text-xs text-gray-600">Optional. Leave blank to use the colored initials block.</p>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="text-sm">
          {error   && <p className="text-red-400">{error}</p>}
          {success && <p className="text-green-400">✓ Saved</p>}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
        >
          {saving ? 'Saving…' : 'Save bio'}
        </button>
      </div>
    </form>
  )
}
