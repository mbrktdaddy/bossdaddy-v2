'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import * as React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { WelcomeEmail } from '@/emails/WelcomeEmail'
import { checkRateLimit } from '@/lib/rate-limit'

const Schema = z.object({
  email: z.string().email(),
  interests: z.array(z.string().max(40)).max(10).optional(),
})

export type SubscribeResult = { ok: true } | { ok: false; error: string }

export async function subscribeToNewsletter(input: { email: string; interests?: string[] }): Promise<SubscribeResult> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'

  const { success } = await checkRateLimit(`newsletter:${ip}`, 'newsletter')
  if (!success) return { ok: false, error: 'Too many requests. Try again later.' }

  const parsed = Schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid email' }

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('newsletter_subscribers')
    .select('interests')
    .eq('email', parsed.data.email)
    .maybeSingle()

  const mergedInterests = Array.from(
    new Set([...(existing?.interests ?? []), ...(parsed.data.interests ?? [])]),
  )

  const { error: dbError } = await supabase
    .from('newsletter_subscribers')
    .upsert(
      { email: parsed.data.email, confirmed: true, interests: mergedInterests },
      { onConflict: 'email' },
    )

  if (dbError) {
    console.error('Newsletter DB error:', dbError)
  }

  try {
    const resend = getResend()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
    await resend.emails.send({
      from: FROM_EMAIL,
      to: parsed.data.email,
      subject: "You're in, Boss. Welcome to the crew. 🔥",
      react: React.createElement(WelcomeEmail, { email: parsed.data.email, siteUrl }),
    })
  } catch (err) {
    console.error('Resend error:', err)
  }

  return { ok: true }
}
