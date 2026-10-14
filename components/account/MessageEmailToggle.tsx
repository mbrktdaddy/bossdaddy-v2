'use client'

// Opt-out toggle for new-message emails (the debounced digest sent by the
// message-emails cron). Writes profiles.email_new_message on the user's own
// row via the profiles self-update RLS policy — same path as avatar/bio edits.
// Optimistic; reverts on failure AND says so — a toggle that silently flips
// back reads as "I tapped it and nothing happened".

import { useId, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Switch } from '@/components/ui/Switch'

export default function MessageEmailToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const switchId = useId()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle(next: boolean) {
    if (saving) return
    setError(null)
    setEnabled(next)
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('signed out')
      const { error: writeError } = await supabase.from('profiles').update({ email_new_message: next }).eq('id', user.id)
      if (writeError) throw writeError
    } catch {
      setEnabled(!next)
      setError('Couldn’t save that. Try again.')
    }
    setSaving(false)
  }

  return (
    <Card className="p-6 mb-6">
      <Eyebrow className="mb-4">Email</Eyebrow>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={switchId} className="block text-sm font-semibold text-prose">Email me about new messages</label>
          <p className="text-xs text-prose-faint mt-0.5 leading-snug">
            A quiet heads-up when someone messages you and you haven&apos;t seen it yet — never the
            message itself.
          </p>
        </div>
        <Switch id={switchId} checked={enabled} onChange={toggle} disabled={saving} />
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{error}</p>}
    </Card>
  )
}
