'use client'

// Opt-out toggle for new-message emails (the debounced digest sent by the
// message-emails cron). Writes profiles.email_new_message on the user's own
// row via the profiles self-update RLS policy — same path as avatar/bio edits.
// Optimistic; reverts on failure.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MessageEmailToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    if (saving) return
    const next = !enabled
    setEnabled(next)
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setEnabled(!next); setSaving(false); return }
    const { error } = await supabase.from('profiles').update({ email_new_message: next }).eq('id', user.id)
    if (error) setEnabled(!next)
    setSaving(false)
  }

  return (
    <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
      <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Notifications</p>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-prose">Email me about new messages</p>
          <p className="text-xs text-prose-faint mt-0.5 leading-snug">
            A quiet heads-up when someone messages you and you haven&apos;t seen it yet — never the
            message itself.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Email me about new messages"
          disabled={saving}
          onClick={toggle}
          className="relative shrink-0 flex items-center min-h-[44px] disabled:opacity-50"
        >
          <span className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-surface-raised border border-strong'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
          </span>
        </button>
      </div>
    </div>
  )
}
