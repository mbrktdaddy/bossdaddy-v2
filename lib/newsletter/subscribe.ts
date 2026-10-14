import 'server-only'
import * as React from 'react'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { WelcomeEmail } from '@/emails/WelcomeEmail'
import { checkRateLimit } from '@/lib/rate-limit'

// The one subscribe path — the server action (every on-site form) and the JSON
// API route both call this, so the rules below can't drift between them again
// (they had: the route and the action were two copies of the same 60 lines).
//
// TWO INTENTS, AND THEY MUST NOT BLEED (continuity plan B5):
//   digest — the weekly email. Tags `newsletter` (+ any extra digest tags).
//   notify — "tell me when X is live". Tags `notify:<topic>` and NEVER
//            `newsletter`: the gift-guide "Notify me" used to save
//            ['newsletter'], silently enrolling people in a weekly email they
//            never asked for. The digest cron sends only to `newsletter` (or
//            legacy untagged) rows, so a notify-only row stays off it.
//
// "Already" is per intent: someone on a notify list who then joins the digest
// is NOT "already subscribed" — they get the welcome email and the success
// state. The welcome email is digest-only (it welcomes you to the weekly).
//
// A DB failure is an error the reader sees (audit-2026-08-16 #18): reporting
// success on a failed write told people they were in when they weren't.

const DIGEST_TAG = 'newsletter'
const TOPIC_RE = /^[a-z0-9][a-z0-9:_-]{0,47}$/

const Input = z.object({
  email: z.string().trim().email().max(254),
  intent: z.enum(['digest', 'notify']),
  topic: z.string().regex(TOPIC_RE).optional(),
  interests: z.array(z.string().max(60)).max(10).optional(),
})

export type SubscribeInput = z.input<typeof Input>

export type SubscribeOutcome =
  | { ok: true; already: boolean }
  | { ok: false; error: string; code: 'invalid' | 'rate_limited' | 'server' }

export async function subscribe(raw: SubscribeInput, { ip }: { ip: string }): Promise<SubscribeOutcome> {
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { ok: false, code: 'invalid', error: "That email doesn't look right." }
  const { email, intent, topic } = parsed.data
  if (intent === 'notify' && !topic) return { ok: false, code: 'invalid', error: 'Missing topic.' }

  const { success } = await checkRateLimit(`newsletter:${ip}`, 'newsletter')
  if (!success) return { ok: false, code: 'rate_limited', error: 'Too many tries. Give it an hour and try again.' }

  const tags = intent === 'digest'
    ? [DIGEST_TAG, ...(parsed.data.interests ?? []).filter((t) => !t.startsWith('notify:'))]
    : [`notify:${topic}`]
  const marker = tags[0]

  const supabase = createAdminClient()
  const { data: existing, error: readError } = await supabase
    .from('newsletter_subscribers')
    .select('interests, confirmed')
    .eq('email', email)
    .maybeSingle()
  if (readError) {
    console.error('[newsletter] lookup failed:', readError.code, readError.message)
    return { ok: false, code: 'server', error: "Couldn't sign you up. Try again in a minute." }
  }

  const had = existing?.interests ?? []
  // Legacy rows (confirmed, no tags) predate tagging and ARE digest readers.
  const already = existing?.confirmed === true &&
    (had.includes(marker) || (intent === 'digest' && had.length === 0))

  const { error: writeError } = await supabase
    .from('newsletter_subscribers')
    .upsert(
      { email, confirmed: true, interests: Array.from(new Set([...had, ...tags])) },
      { onConflict: 'email' },
    )
  if (writeError) {
    console.error('[newsletter] upsert failed:', writeError.code, writeError.message)
    return { ok: false, code: 'server', error: "Couldn't sign you up. Try again in a minute." }
  }

  // Never twice: a repeat signup must not re-send — that's also the abuse
  // vector of submitting someone else's address to spam their inbox.
  if (intent === 'digest' && !already) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
      await getResend().emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "You're in, Boss. Welcome to the crew. 🔥",
        react: React.createElement(WelcomeEmail, { email, siteUrl }),
      })
    } catch (err) {
      // The row is saved; a failed welcome doesn't un-subscribe anyone.
      console.error('[newsletter] welcome email failed:', err)
    }
  }

  return { ok: true, already }
}
