import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { WeeklyDigestEmail } from '@/emails/WeeklyDigestEmail'
import * as React from 'react'

export const maxDuration = 60

interface DigestItem {
  type: 'review' | 'guide'
  title: string
  slug: string
  excerpt: string | null
  image_url: string | null
  category: string
  rating?: number | null
}

// Hit manually with ?secret=... to test, ?dry=1 to skip sending.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not set — newsletter-digest refusing to run')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  const url = new URL(request.url)
  const qSecret = url.searchParams.get('secret')

  const isVercelCron = authHeader === `Bearer ${secret}`
  const isManual     = qSecret === secret
  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dryRun = url.searchParams.get('dry') === '1'

  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  // Past 7 days, approved + visible
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: reviews }, { data: articles }] = await Promise.all([
    admin
      .from('reviews')
      .select('title, slug, excerpt, image_url, category, rating, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .gte('published_at', since)
      .order('rating', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(8),
    admin
      .from('guides')
      .select('title, slug, excerpt, image_url, category, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(8),
  ])

  const items: DigestItem[] = [
    ...(reviews ?? []).map((r) => ({
      type: 'review' as const,
      title: r.title,
      slug: r.slug ?? '',
      excerpt: r.excerpt ?? null,
      image_url: r.image_url ?? null,
      category: r.category,
      rating: r.rating,
    })),
    ...(articles ?? []).map((a) => ({
      type: 'guide' as const,
      title: a.title,
      slug: a.slug ?? '',
      excerpt: a.excerpt ?? null,
      image_url: a.image_url ?? null,
      category: a.category,
    })),
  ].filter((i) => i.slug)

  if (items.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'No new content this week' })
  }

  // Subscribers — only confirmed, only those who opted into newsletter or didn't restrict
  const { data: subs } = await admin
    .from('newsletter_subscribers')
    .select('email, interests')
    .eq('confirmed', true)

  const recipients = (subs ?? [])
    .filter((s) => {
      // Send to anyone who opted into 'newsletter' OR who has no interests recorded
      // (legacy subscribers from before interests were tracked).
      const ints = s.interests ?? []
      return ints.length === 0 || ints.includes('newsletter')
    })
    .map((s) => s.email)

  if (recipients.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'No newsletter subscribers' })
  }

  const weekLabel = `Week of ${new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric',
  })}`

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      itemCount: items.length,
      recipientCount: recipients.length,
      weekLabel,
      sampleItem: items[0] ?? null,
    })
  }

  // Resend batch send — chunks of 100 max per batch.send call.
  const resend = getResend()
  const batches: string[][] = []
  for (let i = 0; i < recipients.length; i += 100) {
    batches.push(recipients.slice(i, i + 100))
  }

  let sent = 0
  let failed = 0
  for (const batch of batches) {
    const payload = batch.map((email) => ({
      from: FROM_EMAIL,
      to: email,
      subject: `${weekLabel} — ${items.length === 1 ? 'one' : items.length} new from Boss Daddy`,
      react: React.createElement(WeeklyDigestEmail, { email, items, weekLabel, siteUrl }),
    }))

    try {
      const result = await resend.batch.send(payload)
      if (result.error) {
        console.error('Resend batch error:', result.error)
        failed += batch.length
      } else {
        // If the call returned without error, treat the whole batch as accepted.
        // Resend's exact response shape varies by SDK version, but a non-error
        // response means delivery has been queued.
        sent += batch.length
      }
    } catch (err) {
      console.error('Resend batch exception:', err)
      failed += batch.length
    }
  }

  return NextResponse.json({
    success: true,
    itemCount: items.length,
    recipientCount: recipients.length,
    sent,
    failed,
    weekLabel,
  })
}
