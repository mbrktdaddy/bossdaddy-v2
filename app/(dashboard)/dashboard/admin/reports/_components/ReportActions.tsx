'use client'

// Status controls for a single abuse report. Open → Mark reviewed / Dismiss.
// Reviewed or dismissed → Reopen. Offender actions (suspend/ban) live in the
// sibling <ModerationActions> reused from user management.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Status = 'open' | 'reviewed' | 'dismissed'

export default function ReportActions({ reportId, status }: { reportId: string; status: Status }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function setStatus(next: Status) {
    setLoading(next); setError(null)
    const res = await fetch('/api/admin/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, status: next }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setError(json.error ?? 'Action failed'); setLoading(null); return }
    setLoading(null)
    router.refresh()
  }

  const btn = 'px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 min-h-[44px]'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'open' ? (
        <>
          <button
            onClick={() => setStatus('reviewed')}
            disabled={loading !== null}
            className={`${btn} bg-surface-raised hover:bg-surface-hover text-prose-muted hover:text-prose`}
          >
            {loading === 'reviewed' ? 'Working…' : 'Mark reviewed'}
          </button>
          <button
            onClick={() => setStatus('dismissed')}
            disabled={loading !== null}
            className={`${btn} bg-surface-raised hover:bg-surface-hover text-prose-muted hover:text-prose`}
          >
            {loading === 'dismissed' ? 'Working…' : 'Dismiss'}
          </button>
        </>
      ) : (
        <button
          onClick={() => setStatus('open')}
          disabled={loading !== null}
          className={`${btn} bg-surface-raised hover:bg-surface-hover text-prose-muted hover:text-prose`}
        >
          {loading === 'open' ? 'Working…' : 'Reopen'}
        </button>
      )}
      {error && <span className="text-xs text-danger-ink">{error}</span>}
    </div>
  )
}
