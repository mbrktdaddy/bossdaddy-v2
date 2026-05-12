'use client'

import { useState } from 'react'

interface Props {
  reviewId: string
  initialFeatured: boolean
}

export default function FeatureToggle({ reviewId, initialFeatured }: Props) {
  const [featured, setFeatured] = useState(initialFeatured)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setBusy(true)
    setError(null)
    const next = !featured
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}/feature`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: next }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Failed to update')
        return
      }
      setFeatured(next)
    } catch {
      setError('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 ${
          featured
            ? 'bg-orange-950/60 border-orange-700/60 text-orange-300 hover:bg-orange-950/80'
            : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-orange-700/60 hover:text-orange-400'
        }`}
        title={featured
          ? 'Currently the homepage hero. Click to remove.'
          : 'Make this review the homepage hero. Replaces any current hero.'}
      >
        <span className="text-sm leading-none">{featured ? '★' : '☆'}</span>
        {featured ? 'Homepage Hero' : 'Set as Hero'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
