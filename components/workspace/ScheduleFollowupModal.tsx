'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reviewId: string
  onClose: () => void
}

const MILESTONE_SUGGESTIONS = [
  '6-Month Update',
  '1-Year Retest',
  'Post-Warranty Check',
  'Long-Term Test',
] as const

export function ScheduleFollowupModal({ reviewId, onClose }: Props) {
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = label.trim()
    if (trimmed.length < 2) {
      setErr('Pick a milestone or type your own — at least 2 characters.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`/api/reviews/${reviewId}/schedule-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestone_label: trimmed }),
      })
      const json = (await res.json().catch(() => ({}))) as { review?: { id: string }; error?: string }
      if (!res.ok) {
        setErr(json.error ?? `Schedule failed (${res.status})`)
        setBusy(false)
        return
      }
      if (json.review?.id) {
        router.push(`/dashboard/reviews/${json.review.id}`)
      } else {
        router.refresh()
        onClose()
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Schedule failed')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-surface-sunken border border-soft rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-soft">
          <p className="text-sm font-bold text-white">Schedule a follow-up review</p>
          <p className="text-xs text-prose-faint mt-0.5">
            We&apos;ll create a draft with a Claude-generated scaffold. You&apos;ll land in the new workspace to edit.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Milestone</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {MILESTONE_SUGGESTIONS.map((s) => {
                const active = label.trim() === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setLabel(s)}
                    disabled={busy}
                    className={`px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-accent border-accent text-white'
                        : 'bg-surface border-strong text-gray-300 hover:bg-surface-raised'
                    }`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              disabled={busy}
              placeholder="Or type a custom label (e.g. After Two Winters)"
              className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-hover text-sm"
              autoFocus
            />
          </div>

          {err && (
            <p className="text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-4 py-2.5">
              {err}
            </p>
          )}

          <p className="text-xs text-prose-faint">
            The draft will inherit the product, category, and author. Hero image is intentionally blank — drop a fresh in-use shot.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-soft flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 bg-surface-raised hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2 bg-accent hover:bg-accent-hover disabled:bg-orange-700 disabled:cursor-wait text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {busy ? 'Scheduling…' : 'Schedule follow-up'}
          </button>
        </div>
      </form>
    </div>
  )
}
