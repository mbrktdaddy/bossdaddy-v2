'use client'

// Per-device web-push enable/disable. Subscribing IS the opt-in (no separate
// pref). Renders nothing when push is unsupported or VAPID keys aren't
// configured, so it never shows a dead control. The permission prompt fires
// only on the explicit "Enable" tap — never on page load.

import { useEffect, useState } from 'react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

// Returns an ArrayBuffer-backed Uint8Array (inferred Uint8Array<ArrayBuffer>)
// so it satisfies BufferSource for applicationServerKey under TS 5.7+ lib types.
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export default function PushNotificationSetting() {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      !!VAPID_PUBLIC
    setSupported(ok)
    if (!ok) return
    setDenied(Notification.permission === 'denied')
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {})
  }, [])

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setDenied(perm === 'denied')
        setBusy(false)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC as string),
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
      if (!res.ok) throw new Error('save failed')
      setEnabled(true)
    } catch {
      setError('Could not enable notifications. Try again.')
    }
    setBusy(false)
  }

  async function disable() {
    setBusy(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setEnabled(false)
    } catch {
      setError('Could not turn off notifications.')
    }
    setBusy(false)
  }

  if (!supported) return null

  return (
    <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
      <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Push Notifications</p>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-prose">Notify me on this device</p>
          <p className="text-xs text-prose-faint mt-0.5 leading-snug">
            A push the moment someone messages you — even when Boss Daddy is closed. On iPhone, add
            the app to your home screen first.
          </p>
          {denied && (
            <p className="text-xs text-danger-ink mt-1.5">
              Notifications are blocked in your browser settings — turn them on there, then try again.
            </p>
          )}
          {error && <p className="text-xs text-danger-ink mt-1.5">{error}</p>}
        </div>
        <button
          type="button"
          disabled={busy || denied}
          onClick={enabled ? disable : enable}
          className={`shrink-0 min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
            enabled
              ? 'bg-surface-raised border border-strong text-prose hover:bg-surface'
              : 'bg-accent hover:bg-accent-hover text-white'
          }`}
        >
          {busy ? '…' : enabled ? 'Turn off' : 'Enable'}
        </button>
      </div>
    </div>
  )
}
