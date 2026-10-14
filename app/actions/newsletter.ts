'use server'

import { headers } from 'next/headers'
import { subscribe } from '@/lib/newsletter/subscribe'

// Server actions over the one subscribe path (lib/newsletter/subscribe.ts —
// the rules, the intents and the "why" live there).

async function clientIp() {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
}

// ── <NewsletterSignup> — a `<form action>` via useActionState ────────────────
// Works before hydration (and with JS off): the form posts to the page, React
// runs this, and the page re-renders in the returned state. That's what let
// the old form-POST branch of /api/newsletter/subscribe retire — and with it
// the redirect to `/?newsletter=…` that nothing ever read (B1: the homepage
// signup gave no feedback at all).

export type NewsletterFormState =
  | { status: 'idle' }
  | { status: 'success' | 'already' }
  // `email` comes back so the field can be refilled — React resets the form
  // after an action, and retyping an address because of a typo is the tax.
  | { status: 'error'; message: string; email: string }

export async function subscribeFromForm(_prev: NewsletterFormState, form: FormData): Promise<NewsletterFormState> {
  const email = String(form.get('email') ?? '')
  const intent = form.get('intent') === 'notify' ? 'notify' : 'digest'
  const topic = form.get('topic') ? String(form.get('topic')) : undefined
  const interests = String(form.get('interests') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  const result = await subscribe({ email, intent, topic, interests }, { ip: await clientIp() })
  if (!result.ok) return { status: 'error', message: result.error, email }
  return { status: result.already ? 'already' : 'success' }
}
