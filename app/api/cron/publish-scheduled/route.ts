import { NextResponse, type NextRequest, after } from 'next/server'
import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { prewarmOgForPaths } from '@/lib/og/prewarm'
import { revalidateGuidePaths, revalidateReviewPaths } from '@/lib/revalidate'
import { isDisclosureBlocked } from '@/lib/reviews'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { ModerationResultEmail } from '@/emails/ModerationResultEmail'
import * as React from 'react'

export const maxDuration = 30

// Secured by Vercel Cron secret. Hit manually with ?secret=... for testing.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Fail closed — never run unauthenticated
    console.error('CRON_SECRET is not set — cron endpoint refusing to run')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  const qSecret = new URL(request.url).searchParams.get('secret')

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically
  const isVercelCron = authHeader === `Bearer ${secret}`
  const isManual     = qSecret === secret

  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Find items whose scheduled time has arrived and are not yet live.
  // Reviews + guides use status='approved' as their "live" state; collections
  // use is_visible=true.
  const [{ data: dueArticles }, { data: dueReviews }, { data: dueCollections }] = await Promise.all([
    // The status filter is deliberately WIDER than what we will publish. We
    // fetch draft/pending/rejected so that a row scheduled without being
    // submitted can be REPORTED rather than silently ignored — see the gate
    // below. Narrowing this to `pending` would make stranded rows invisible.
    admin
      .from('guides')
      .select('id, slug, title, author_id, category, status, has_affiliate_links, disclosure_acknowledged')
      .not('scheduled_publish_at', 'is', null)
      .lte('scheduled_publish_at', now)
      .in('status', ['draft', 'pending', 'rejected']),
    admin
      .from('reviews')
      .select('id, slug, title, author_id, category, status, has_affiliate_links, disclosure_acknowledged')
      .not('scheduled_publish_at', 'is', null)
      .lte('scheduled_publish_at', now)
      .in('status', ['draft', 'pending', 'rejected']),
    admin
      .from('collections')
      .select('id, slug, title, collection_type, occasion')
      .not('scheduled_publish_at', 'is', null)
      .lte('scheduled_publish_at', now)
      .eq('is_visible', false),
  ])

  // ── Publication gates ────────────────────────────────────────────────────
  // Two independent reasons a due row must not go live:
  //
  //  1. STATE MACHINE. CLAUDE.md: draft → pending → approved, and only an
  //     admin approves. Scheduling used to jump draft → approved directly,
  //     which skipped `submit` — and therefore skipped submit's disclosure
  //     gate and the moderation pass it triggers. Scheduling now publishes
  //     only what has actually been submitted for review.
  //
  //  2. FTC DISCLOSURE. A row carrying affiliate links whose disclosure has
  //     not been acknowledged must never become public. Re-asserted here even
  //     though submit checks it, because `has_affiliate_links` is recomputed
  //     on every content edit — a row can acquire affiliate links AFTER it was
  //     acknowledged. Approval is the moment the links go public, so approval
  //     is the moment that has to hold. (Guides currently have no
  //     `disclosure_acknowledged` column; migration 148 adds one.)
  //
  // Both WITHHOLD rather than drop. The row keeps its `scheduled_publish_at`,
  // so fixing the cause publishes it on the next tick — and both report, so a
  // row can never sit stranded and silent. A withheld row re-reports every 15
  // minutes, hence the per-row fingerprint: Sentry groups instead of flooding.
  type GatedRow = {
    id: string
    title: string
    slug: string | null
    status: string
    has_affiliate_links?: boolean | null
    disclosure_acknowledged?: boolean | null
  }

  const withholdReason = (row: GatedRow): string | null => {
    if (row.status !== 'pending') return `not submitted for review (status: ${row.status})`
    if (isDisclosureBlocked({
      has_affiliate_links: row.has_affiliate_links ?? null,
      disclosure_acknowledged: row.disclosure_acknowledged ?? null,
    })) return 'affiliate links present, disclosure not acknowledged'
    return null
  }

  const gate = <T extends GatedRow>(rows: T[], kind: 'review' | 'guide'): T[] => {
    const publishable: T[] = []
    for (const row of rows) {
      const reason = withholdReason(row)
      if (!reason) { publishable.push(row); continue }
      Sentry.captureMessage(`Scheduled ${kind} "${row.title}" withheld: ${reason}`, {
        level: 'warning',
        fingerprint: ['scheduled-publish-withheld', kind, row.id],
        extra: { id: row.id, slug: row.slug, status: row.status, reason },
      })
    }
    return publishable
  }

  const publishableArticles = gate(dueArticles ?? [], 'guide')
  const publishableReviews  = gate(dueReviews  ?? [], 'review')

  const withheldCount =
    ((dueArticles ?? []).length - publishableArticles.length) +
    ((dueReviews  ?? []).length - publishableReviews.length)

  const articleIds    = publishableArticles.map((a) => a.id)
  const reviewIds     = publishableReviews.map((r) => r.id)
  const collectionIds = (dueCollections ?? []).map((c) => c.id)

  let articlesPublished    = 0
  let reviewsPublished     = 0
  let collectionsPublished = 0

  if (articleIds.length) {
    const { error, count } = await admin
      .from('guides')
      .update({
        status:               'approved',
        published_at:         now,
        scheduled_publish_at: null,
      }, { count: 'exact' })
      .in('id', articleIds)
    if (error) console.error('Scheduled article publish failed:', error)
    articlesPublished = count ?? 0
  }

  if (reviewIds.length) {
    const { error, count } = await admin
      .from('reviews')
      .update({
        status:               'approved',
        published_at:         now,
        scheduled_publish_at: null,
      }, { count: 'exact' })
      .in('id', reviewIds)
    if (error) console.error('Scheduled review publish failed:', error)
    reviewsPublished = count ?? 0
  }

  if (collectionIds.length) {
    // Collections use is_visible + published_at; no status column. Set both.
    const { error, count } = await admin
      .from('collections')
      .update({
        is_visible:           true,
        published_at:         now,
        scheduled_publish_at: null,
      }, { count: 'exact' })
      .in('id', collectionIds)
    if (error) console.error('Scheduled collection publish failed:', error)
    collectionsPublished = count ?? 0
  }

  // Collect the just-published content paths so we can pre-warm their OG preview
  // images below — the first social scrape then hits a warm CDN cache instead of
  // a cold ~2s MISS (which X can time out on and cache as a blank card).
  const warmPaths: string[] = []

  // Revalidate public pages that might have changed
  if (articlesPublished > 0) {
    revalidateGuidePaths(publishableArticles)
    warmPaths.push(...publishableArticles.filter((a) => a.slug).map((a) => `/guides/${a.slug}`))
  }
  if (reviewsPublished > 0) {
    revalidateReviewPaths(publishableReviews)
    warmPaths.push(...publishableReviews.filter((r) => r.slug).map((r) => `/reviews/${r.slug}`))
  }
  if (collectionsPublished > 0) {
    revalidatePath('/')
    revalidatePath('/picks')
    revalidatePath('/comparisons')
    revalidatePath('/stacks')
    revalidatePath('/gifts')
    // Route each newly-live collection to its type-specific detail URL.
    const { OCCASIONS } = await import('@/lib/gift-occasions')
    for (const c of (dueCollections ?? [])) {
      if (!c.slug) continue
      let path: string | null = null
      if (c.collection_type === 'comparison') path = `/comparisons/${c.slug}`
      else if (c.collection_type === 'stack')  path = `/stacks/${c.slug}`
      else if (c.collection_type === 'gift_guide') {
        const occ = OCCASIONS.find((o) => o.value === c.occasion)
        if (occ) path = `/gifts/${occ.slug}`
      }
      else path = `/picks/${c.slug}`
      if (path) {
        revalidatePath(path)
        warmPaths.push(path)
      }
    }
  }

  // Pre-warm OG images for everything that just went live (post-response).
  if (warmPaths.length) after(() => prewarmOgForPaths(warmPaths))

  // Send author notifications + wishlist alerts (fire-and-forget, don't block response)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  if (process.env.RESEND_API_KEY) {
    const resend = getResend()

    const notifyAuthor = async (authorId: string, title: string, contentType: 'review' | 'guide') => {
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(authorId)
        const email = authUser?.user?.email
        if (!email) return
        await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: '🎉 Your content is live on Boss Daddy Life',
          react: React.createElement(ModerationResultEmail, {
            action: 'approve', contentType, title, siteUrl,
          }),
        })
      } catch (err) { console.error('Scheduled publish author notify failed:', err) }
    }

    const notifyWishlist = async (reviewId: string, reviewTitle: string, reviewSlug: string) => {
      try {
        const { data: wishlistItem } = await admin
          .from('products').select('id').eq('review_id', reviewId).maybeSingle()
        if (!wishlistItem) return
        const { data: subs } = await admin
          .from('wishlist_subscriptions').select('id, user_id')
          .eq('wishlist_item_id', wishlistItem.id).eq('notified', false)
        if (!subs?.length) return
        for (const sub of subs) {
          try {
            const { data: authUser } = await admin.auth.admin.getUserById(sub.user_id as string)
            const email = authUser?.user?.email
            if (email) {
              await resend.emails.send({
                from: FROM_EMAIL,
                to: email,
                subject: `Boss Daddy reviewed ${reviewTitle} — read it now`,
                html: `<p>Hey! You asked to be notified when Boss Daddy reviewed <strong>${reviewTitle}</strong>.</p>
<p><a href="${siteUrl}/reviews/${reviewSlug}" style="background:#CC5500;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">Read the review</a></p>
<p style="color:#888;font-size:12px;">You're receiving this because you subscribed to this item on the Boss Daddy wishlist.</p>`,
              })
              await admin.from('wishlist_subscriptions')
                .update({ notified: true, notified_at: new Date().toISOString() })
                .eq('id', sub.id)
            }
          } catch (err) { console.error('Wishlist notify failed for', sub.user_id, err) }
        }
      } catch (err) { console.error('Wishlist batch notify failed for review', reviewId, err) }
    }

    await Promise.allSettled([
      ...publishableArticles.filter(a => a.author_id).map(a =>
        notifyAuthor(a.author_id as string, a.title as string, 'guide')
      ),
      // publishableReviews, not dueReviews — a disclosure-blocked review must
      // not tell its author it went live, and must not fire wishlist alerts
      // pointing at a page that is still a draft.
      ...publishableReviews.filter(r => r.author_id).map(r =>
        notifyAuthor(r.author_id as string, r.title as string, 'review')
      ),
      ...publishableReviews.filter(r => r.slug).map(r =>
        notifyWishlist(r.id, r.title as string, r.slug as string)
      ),
    ])
  }

  return NextResponse.json({
    success: true,
    articlesPublished,
    reviewsPublished,
    collectionsPublished,
    withheld: withheldCount,
    checkedAt: now,
  })
}
