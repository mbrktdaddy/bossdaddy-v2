'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buttonVariants } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Card } from '@/components/ui/Card'

type Step = 'idle' | 'editing' | 'verifying' | 'sent'

export default function EditEmailForm({ current }: { current: string }) {
  const [step, setStep]   = useState<Step>('idle')
  const [email, setEmail] = useState('')
  const [otp, setOtp]     = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || trimmed === current) return
    setBusy(true); setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.reauthenticate()
    if (err) { setError(err.message); setBusy(false); return }
    setStep('verifying'); setBusy(false)
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!otp.trim()) return
    setBusy(true); setError(null)
    const supabase = createClient()
    const { error: verifyErr } = await supabase.auth.verifyOtp({ email: current, token: otp.trim(), type: 'email' as const })
    if (verifyErr) { setError('Invalid or expired code. Check your email and try again.'); setBusy(false); return }
    const { error: updateErr } = await supabase.auth.updateUser({ email: email.trim() })
    if (updateErr) { setError(updateErr.message); setBusy(false); return }
    setStep('sent'); setBusy(false)
  }

  function reset() { setStep('idle'); setEmail(''); setOtp(''); setError(null) }

  if (step === 'sent') {
    return (
      <div role="status" className="bg-success-bg border border-success-line rounded-xl p-4">
        <p className="text-success-ink text-sm font-semibold mb-1">Confirmation sent</p>
        <p className="text-prose-muted text-sm">
          Check <span className="text-prose">{email.trim()}</span>{' '}for a confirmation link.
          Your email won&apos;t change until you click it.
        </p>
        <button onClick={reset} className={buttonVariants({ variant: 'outline', className: 'mt-3' })}>Done</button>
      </div>
    )
  }

  if (step === 'verifying') {
    return (
      <form onSubmit={handleOtpSubmit} className="space-y-3">
        <Card tone="sunken" className="p-4">
          <p className="text-prose text-sm font-semibold mb-1">Check your current email</p>
          <p className="text-prose-muted text-xs">
            We sent a 6-digit verification code to <span className="text-prose">{current}</span>. Enter it below to confirm the change.
          </p>
        </Card>
        <Field
          label="Verification code"
          type="text" inputMode="numeric" maxLength={6} value={otp}
          onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError(null) }}
          placeholder="000000" required autoComplete="one-time-code"
          controlClassName="tracking-widest text-center font-bold"
          error={error}
        />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy || otp.length < 6}
            className={buttonVariants()}>
            {busy ? 'Verifying…' : 'Verify & Change Email'}
          </button>
          <button type="button" onClick={reset} className={buttonVariants({ variant: 'outline' })}>Cancel</button>
        </div>
      </form>
    )
  }

  if (step === 'editing') {
    return (
      <form onSubmit={handleEmailSubmit} className="space-y-3">
        <Field
          label="New email address"
          type="email" value={email} onChange={e => { setEmail(e.target.value); setError(null) }}
          autoComplete="email"
          placeholder="New email address" required
          hint="We'll send a verification code to your current email to confirm it's you."
          error={error}
        />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy || !email.trim() || email.trim() === current}
            className={buttonVariants()}>
            {busy ? 'Sending code…' : 'Continue'}
          </button>
          <button type="button" onClick={reset} className={buttonVariants({ variant: 'outline' })}>Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-prose-muted">{current}</p>
      <button onClick={() => setStep('editing')} className={buttonVariants({ variant: 'outline', className: 'shrink-0' })}>Change</button>
    </div>
  )
}
