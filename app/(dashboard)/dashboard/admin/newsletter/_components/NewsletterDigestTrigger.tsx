'use client'

import { useState } from 'react'

export function NewsletterDigestTrigger() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function trigger(dry: boolean) {
    if (busy) return
    if (!dry && !confirm('Send the weekly digest now to all subscribers?')) return

    setBusy(true); setResult(null); setError(null)
    try {
      const res = await fetch(`/api/admin/newsletter/send-digest${dry ? '?dry=1' : ''}`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Send failed')
      if (json.skipped) {
        setResult(`Skipped: ${json.reason}`)
      } else if (json.dryRun) {
        setResult(`Dry run — would send ${json.itemCount} item${json.itemCount === 1 ? '' : 's'} to ${json.recipientCount} subscriber${json.recipientCount === 1 ? '' : 's'}.`)
      } else {
        setResult(`Sent: ${json.sent} delivered · ${json.failed} failed · ${json.itemCount} items.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => trigger(true)}
          disabled={busy}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-xs font-semibold rounded-lg transition-colors"
        >
          {busy ? '…' : 'Dry run'}
        </button>
        <button
          type="button"
          onClick={() => trigger(false)}
          disabled={busy}
          className="px-3 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {busy ? 'Sending…' : 'Send digest now'}
        </button>
      </div>
      {result && <p className="text-xs text-green-400 max-w-xs text-right">{result}</p>}
      {error  && <p className="text-xs text-red-400  max-w-xs text-right">{error}</p>}
    </div>
  )
}
