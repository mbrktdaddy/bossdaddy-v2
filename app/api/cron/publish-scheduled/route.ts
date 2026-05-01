import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
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

  // Find items whose scheduled time has arrived and are not yet live
  const [{ data: dueArticles }, { data: dueReviews }] = await Promise.all([
    admin
      .from('guides')
      .select('id, slug, title, author_id')
      .not('scheduled_publish_at', 'is', null)
      .lte('scheduled_publish_at', now)
      .in('status', ['draft', 'pending', 'rejected']),
    admin
      .from('reviews')
      .select('id, slug, title, author_id')
      .not('scheduled_publish_at', 'is', null)
      .lte('scheduled_publish_at', now)
      .in('status', ['draft', 'pending', 'rejected']),
  ])

  const articleIds = (dueArticles ?? []).map((a) => a.id)
  const reviewIds  = (dueReviews ?? []).map((r) => r.id)

  let articlesPublished = 0
  let reviewsPublished  = 0

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

  // Revalidate public pages that might have changed
  if (articlesPublished > 0) {
    revalidatePath('/')
    revalidatePath('/guides')
    ;(dueArticles ?? []).forEach((a) => a.slug && revalidatePath(`/guides/${a.slug}`))
  }
  if (reviewsPublished > 0) {
    revalidatePath('/')
    revalidatePath('/reviews')
    revalidatePath('/about')
    ;(dueReviews ?? []).forEach((r) => r.slug && revalidatePath(`/reviews/${r.slug}`))
  }

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
          .from('wishlist_items').select('id').eq('review_id', reviewId).maybeSingle()
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
      ...(dueArticles ?? []).filter(a => a.author_id).map(a =>
        notifyAuthor(a.author_id as string, a.title as string, 'guide')
      ),
      ...(dueReviews ?? []).filter(r => r.author_id).map(r =>
        notifyAuthor(r.author_id as string, r.title as string, 'review')
      ),
      ...(dueReviews ?? []).filter(r => r.slug).map(r =>
        notifyWishlist(r.id, r.title as string, r.slug as string)
      ),
    ])
  }

  return NextResponse.json({
    success: true,
    articlesPublished,
    reviewsPublished,
    checkedAt: now,
  })
}
