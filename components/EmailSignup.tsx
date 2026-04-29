'use client'

import { useState, useTransition } from 'react'
import { subscribeToNewsletter } from '@/app/actions/newsletter'

interface Props {
  /** Heading shown above the form. Pass null to hide. */
  heading?: string | null
  /** Subhead/description shown below the heading. */
  description?: string | null
  /** Label on the submit button. Defaults to "Notify me". */
  buttonLabel?: string
  /** Message shown after a successful signup. */
  successMessage?: string
  /** Tags recorded against this signup (e.g. ['shop_launch', 'merch_apparel']) */
  interests?: string[]
  /** Compact variant — smaller padding, single line. */
  compact?: boolean
}

export function EmailSignup({
  heading = 'Get notified',
  description = null,
  buttonLabel = 'Notify me',
  successMessage = "You're on the list. We'll be in touch.",
  interests = [],
  compact = false,
}: Props) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setState('submitting'); setError(null)
    startTransition(async () => {
      const result = await subscribeToNewsletter({ email: email.trim(), interests })
      if (!result.ok) {
        setState('error')
        setError(result.error)
        return
      }
      setState('success')
      setEmail('')
    })
  }

  if (state === 'success') {
    return (
      <div className={`bg-green-950/30 border border-green-800/40 rounded-2xl ${compact ? 'p-3' : 'p-5'}`}>
        <p className={`text-green-400 ${compact ? 'text-sm' : 'text-base'} font-semibold flex items-center gap-2`}>
          <span>✓</span>
          {successMessage}
        </p>
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'space-y-3'}>
      {heading && (
        <p className={`font-bold ${compact ? 'text-sm' : 'text-lg'} text-white`}>{heading}</p>
      )}
      {description && (
        <p className={`text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>{description}</p>
      )}
      <form onSubmit={handleSubmit} className={`flex gap-2 ${compact ? '' : 'flex-col sm:flex-row mt-3'}`}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={state === 'submitting'}
          className={`min-w-0 ${compact ? 'flex-1 px-3 py-2 text-sm' : 'w-full sm:flex-1 px-4 py-3'} bg-gray-900 border border-gray-700 focus:border-orange-500 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors disabled:opacity-60`}
        />
        <button
          type="submit"
          disabled={state === 'submitting' || !email.trim()}
          className={`${compact ? 'shrink-0 px-4 py-2 text-sm' : 'w-full sm:w-auto px-5 py-3'} bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors`}
        >
          {state === 'submitting' ? 'Sending…' : buttonLabel}
        </button>
      </form>
      {error && (
        <p className={`${compact ? 'text-xs' : 'text-sm'} text-red-400 mt-2`}>{error}</p>
      )}
    </div>
  )
}
