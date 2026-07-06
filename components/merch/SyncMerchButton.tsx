'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Triggers POST /api/merch/sync (pull Printful products → merch tables) from the
// dashboard, so the CLI `npm run merch:sync` isn't needed for routine syncs.
export function SyncMerchButton({ className = '' }: { className?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function sync() {
    setBusy(true); setMsg(null); setErr(null)
    try {
      const res = await fetch('/api/merch/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Sync failed')
      setMsg(
        `Synced ${json.products} product${json.products === 1 ? '' : 's'} · ${json.variants} variant${json.variants === 1 ? '' : 's'}` +
        (json.archived ? ` · ${json.archived} archived` : '') +
        (json.errors ? ` · ${json.errors} error${json.errors === 1 ? '' : 's'}` : ''),
      )
      router.refresh()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="px-4 py-2.5 bg-surface-raised hover:bg-surface-hover border border-soft text-prose text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
        title="Pull the latest products from Printful into the shop"
      >
        {busy ? 'Syncing…' : 'Sync from Printful'}
      </button>
      {msg && <span className="text-[11px] text-forest max-w-[220px] text-right">{msg}</span>}
      {err && <span className="text-[11px] text-danger-ink max-w-[220px] text-right">{err}</span>}
    </div>
  )
}
