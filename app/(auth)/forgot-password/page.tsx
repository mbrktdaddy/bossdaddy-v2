'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { buttonVariants } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import PageHeader from '@/components/PageHeader'
import { LABELS } from '@/lib/labels'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-callback`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  // The "sent" state keeps the same left-aligned lockup as the form (the old
  // centred envelope-in-a-circle was a one-off; the label block + rule carry it).
  if (sent) {
    return (
      <>
        <PageHeader
          size="compact"
          eyebrow={LABELS.auth.recoveryEyebrow}
          title={LABELS.auth.forgot.sentH1}
          className="mb-6"
        />
        <p className="text-sm text-prose-muted leading-relaxed">
          We sent a reset link to <span className="font-semibold text-prose">{email}</span>. Click it to set a new password.
        </p>
        <p className="mt-4 text-sm text-prose-faint">
          Didn&apos;t get it? Check your spam folder or{' '}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="inline-block py-3 -my-3 font-semibold text-accent-text hover:text-accent"
          >
            try again
          </button>
          .
        </p>
      </>
    )
  }

  return (
    <>
      <PageHeader
        size="compact"
        eyebrow={LABELS.auth.recoveryEyebrow}
        title={LABELS.auth.forgot.h1}
        deck="Enter your email and we’ll send you a reset link."
        className="mb-6"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Email"
          autoComplete="username"
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        {error && (
          <p role="alert" className="text-sm font-medium text-danger-ink bg-danger-bg border border-danger-line rounded-md px-4 py-2.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={buttonVariants({ className: 'w-full' })}
        >
          {loading ? 'Sending…' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-prose-faint">
        Remember it?{' '}
        <Link href="/login" className="inline-block py-3 -my-3 font-semibold text-accent-text hover:text-accent">
          Sign in
        </Link>
      </p>
    </>
  )
}
