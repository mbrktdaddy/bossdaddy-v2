import * as React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { WishlistStatusEmail, getWishlistStatusSubject } from '@/emails/WishlistStatusEmail'

type NotifiableStatus = 'queued' | 'testing' | 'reviewed'

interface NotifyParams {
  itemId: string
  status: NotifiableStatus
  /** Only set for 'reviewed' status — the slug of the published review */
  reviewSlug?: string | null
}

/**
 * Send status-update emails to every subscriber of a wishlist item.
 *
 * Pulls the item's current data, fetches all subscriptions, then emails each
 * subscriber the appropriate template based on the new status. For the
 * 'reviewed' transition, marks the subscription as notified to prevent
 * duplicate sends if the cron job also fires.
 *
 * Errors per subscriber are caught and logged — one bad email won't stop
 * the rest of the batch.
 */
export async function notifyWishlistSubscribers({ itemId, status, reviewSlug }: NotifyParams): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  const admin = createAdminClient()

  // Fetch item details for the email
  const { data: item } = await admin
    .from('wishlist_items')
    .select('id, slug, title, image_url')
    .eq('id', itemId)
    .single()

  if (!item) return

  // Fetch subscribers — for 'reviewed' status, only those not yet notified
  let subsQuery = admin
    .from('wishlist_subscriptions')
    .select('id, user_id, unsubscribe_token')
    .eq('wishlist_item_id', itemId)
  if (status === 'reviewed') {
    subsQuery = subsQuery.eq('notified', false)
  }

  const { data: subs } = await subsQuery
  if (!subs || subs.length === 0) return

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const subject = getWishlistStatusSubject(status, item.title as string)

  for (const sub of subs) {
    const { data: authUser } = await admin.auth.admin.getUserById(sub.user_id as string)
    const email = authUser?.user?.email
    if (!email) continue

    const result = await sendEmail({
      to: email,
      subject,
      tag: `wishlist_${status}`,
      react: React.createElement(WishlistStatusEmail, {
        status,
        itemTitle: item.title as string,
        itemSlug: item.slug as string,
        itemImageUrl: item.image_url as string | null,
        reviewSlug: reviewSlug ?? null,
        siteUrl,
        unsubscribeToken: (sub as { unsubscribe_token?: string | null }).unsubscribe_token ?? null,
      }),
    })

    // Only mark notified on success so failed sends get retried next time
    if (result.ok && status === 'reviewed') {
      await admin
        .from('wishlist_subscriptions')
        .update({ notified: true, notified_at: new Date().toISOString() })
        .eq('id', sub.id)
    }
  }
}
