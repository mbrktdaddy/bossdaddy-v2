import { NextResponse, type NextRequest, after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { snapshotRevision } from '@/lib/revisions'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeHtml } from '@/lib/sanitize'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { resolveProductTokens } from '@/lib/products'
import { computeReadingTime } from '@/lib/reading-time'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { ModerationResultEmail } from '@/emails/ModerationResultEmail'
import { CATEGORY_SLUGS } from '@/lib/categories'
import * as React from 'react'
import { z } from 'zod'

const CategorySchema = z.enum(CATEGORY_SLUGS as [string, ...string[]])

const UpdateSchema = z.object({
  title:                    z.string().min(10).max(120).optional(),
  product_name:             z.string().min(2).max(120).optional(),
  category:                 CategorySchema.optional(),
  excerpt:                  z.string().max(200).optional(),
  content:                  z.string().min(100).optional(),
  rating:                   z.number().min(1).max(10).optional(),
  pros:                     z.array(z.string()).optional(),
  cons:                     z.array(z.string()).optional(),
  disclosure_acknowledged:  z.boolean().optional(),
  image_url:                z.string().url().optional().nullable(),
  meta_title:               z.string().max(70).optional().nullable(),
  meta_description:         z.string().max(200).optional().nullable(),
  scheduled_publish_at:     z.string().datetime().optional().nullable(),
  product_slug:             z.string().regex(/^[a-z0-9-]+$/).max(120).optional().nullable(),
})

const ModerateSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_edits', 'unpublish', 'toggle_visibility']),
  rejection_reason: z.string().optional(),
})

// GET /api/reviews/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('id', id)
    .single()

  if (!error) return NextResponse.json({ review: data })

  // RLS may block pending reviews from non-authors — bypass for admins
  const { user } = await getUserSafe(supabase)
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'admin') {
      const admin = createAdminClient()
      const { data: adminData, error: adminErr } = await admin.from('reviews').select('*').eq('id', id).single()
      if (!adminErr) return NextResponse.json({ review: adminData })
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

// PUT /api/reviews/[id] — update draft or moderate (admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)

  // Admin moderation action
  const modParsed = ModerateSchema.safeParse(body)
  if (modParsed.success) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()
    const updateData: Record<string, unknown> = {}

    if (modParsed.data.action === 'approve') {
      updateData.status = 'approved'
      updateData.published_at = new Date().toISOString()
    } else if (modParsed.data.action === 'reject') {
      updateData.status = 'rejected'
      updateData.rejection_reason = modParsed.data.rejection_reason ?? ''
    } else if (modParsed.data.action === 'unpublish') {
      updateData.status = 'draft'
      updateData.published_at = null
    } else if (modParsed.data.action === 'toggle_visibility') {
      const { data: current } = await admin.from('reviews').select('is_visible').eq('id', id).single()
      updateData.is_visible = !(current?.is_visible ?? true)
    } else {
      updateData.status = 'draft'
      updateData.rejection_reason = modParsed.data.rejection_reason ?? ''
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await admin.from('reviews').update(updateData as any).eq('id', id).select('*').single()
    if (error) {
      console.error('Review moderation update failed:', error)
      return NextResponse.json({ error: `Moderation action failed: ${error.message}` }, { status: 500 })
    }

    revalidatePath('/')
    revalidatePath('/reviews')
    revalidatePath('/about')
    if (data?.slug) revalidatePath(`/reviews/${data.slug}`)

    // Send email notification — scheduled via after() so it doesn't block the response
    const notifyActions = ['approve', 'reject', 'request_edits'] as const
    if (notifyActions.includes(modParsed.data.action as typeof notifyActions[number]) && data?.author_id && process.env.RESEND_API_KEY) {
      const authorId = data.author_id as string
      const action = modParsed.data.action as 'approve' | 'reject' | 'request_edits'
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
      const reviewTitle = data.title as string
      const rejectionReason = modParsed.data.rejection_reason
      try {
        after(async () => {
          try {
            const { data: authUser } = await admin.auth.admin.getUserById(authorId)
            const email = authUser?.user?.email
            if (!email) return
            await getResend().emails.send({
              from: FROM_EMAIL,
              to: email,
              subject: action === 'approve' ? '🎉 Your review is live on Boss Daddy Life'
                : action === 'reject' ? 'Update on your Boss Daddy submission'
                : 'Edits requested on your Boss Daddy submission',
              react: React.createElement(ModerationResultEmail, {
                action, contentType: 'review', title: reviewTitle,
                reason: rejectionReason, siteUrl,
              }),
            })
          } catch (err) { console.error('Review notification failed:', err) }
        })
      } catch (err) { console.error('after() registration failed (review):', err) }
    }

    // Notify wishlist subscribers when a linked review goes live
    if (modParsed.data.action === 'approve' && data && process.env.RESEND_API_KEY) {
      const reviewId = id
      const reviewTitle = data.title as string
      const reviewSlug = data.slug as string
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
      try {
        after(async () => {
          try {
            // Find the wishlist item linked to this review
            const { data: wishlistItem } = await admin
              .from('wishlist_items')
              .select('id, title')
              .eq('review_id', reviewId)
              .maybeSingle()
            if (!wishlistItem) return

            // Fetch unnotified subscribers
            const { data: subs } = await admin
              .from('wishlist_subscriptions')
              .select('id, user_id')
              .eq('wishlist_item_id', wishlistItem.id)
              .eq('notified', false)
            if (!subs || subs.length === 0) return

            // Send each subscriber an email and mark notified
            for (const sub of subs) {
              try {
                const { data: authUser } = await admin.auth.admin.getUserById(sub.user_id as string)
                const email = authUser?.user?.email
                if (email) {
                  await getResend().emails.send({
                    from: FROM_EMAIL,
                    to: email,
                    subject: `Boss Daddy reviewed ${reviewTitle} — read it now`,
                    html: `<p>Hey! You asked to be notified when Boss Daddy reviewed <strong>${reviewTitle}</strong>.</p>
<p><a href="${siteUrl}/reviews/${reviewSlug}" style="background:#CC5500;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">Read the review</a></p>
<p style="color:#888;font-size:12px;">You're receiving this because you subscribed to this item on the Boss Daddy wishlist.</p>`,
                  })
                  await admin
                    .from('wishlist_subscriptions')
                    .update({ notified: true, notified_at: new Date().toISOString() })
                    .eq('id', sub.id)
                }
              } catch (err) { console.error('Wishlist subscriber notify failed for', sub.user_id, err) }
            }
          } catch (err) { console.error('Wishlist subscriber batch notify failed:', err) }
        })
      } catch (err) { console.error('after() registration failed (wishlist notify):', err) }
    }

    return NextResponse.json({ review: data })
  }

  // Author update
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (parsed.data.title) updates.title = parsed.data.title
  if (parsed.data.product_name) updates.product_name = parsed.data.product_name
  if (parsed.data.category) updates.category = parsed.data.category
  if (parsed.data.excerpt !== undefined) updates.excerpt = parsed.data.excerpt
  if (parsed.data.image_url !== undefined) updates.image_url = parsed.data.image_url
  if (parsed.data.rating) updates.rating = parsed.data.rating
  if (parsed.data.pros) updates.pros = parsed.data.pros
  if (parsed.data.cons) updates.cons = parsed.data.cons
  if (typeof parsed.data.disclosure_acknowledged === 'boolean') {
    updates.disclosure_acknowledged = parsed.data.disclosure_acknowledged
  }
  if (parsed.data.meta_title !== undefined) updates.meta_title = parsed.data.meta_title
  if (parsed.data.meta_description !== undefined) updates.meta_description = parsed.data.meta_description
  if (parsed.data.scheduled_publish_at !== undefined) updates.scheduled_publish_at = parsed.data.scheduled_publish_at
  if (parsed.data.product_slug !== undefined) updates.product_slug = parsed.data.product_slug
  if (parsed.data.content) {
    const resolved = await resolveProductTokens(parsed.data.content, supabase)
    const sanitized = sanitizeHtml(resolved)
    updates.content = sanitized
    updates.has_affiliate_links = detectAffiliateLinks(sanitized)
    updates.reading_time_minutes = computeReadingTime(sanitized)
  }

  // Use admin client — verify ownership + status manually to avoid RLS silent failures
  const adminForUpdate = createAdminClient()
  const { data: current } = await adminForUpdate.from('reviews').select('*').eq('id', id).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Admin can edit any review at any status; authors only their own drafts/rejected
  const { data: profileForUpdate } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdminEditor = profileForUpdate?.role === 'admin'

  if (!isAdminEditor) {
    if (current.author_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!['draft', 'rejected'].includes(current.status)) {
      return NextResponse.json({ error: 'Only draft or rejected reviews can be edited' }, { status: 422 })
    }
  }

  const wasApproved = current.status === 'approved'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await adminForUpdate.from('reviews').update(updates as any).eq('id', id).select().single()
  if (error) {
    console.error('Review author/admin update failed:', error)
    return NextResponse.json({ error: `Update failed: ${error.message}` }, { status: 500 })
  }

  // Snapshot the PREVIOUS state for version history (fire-and-forget)
  snapshotRevision('review', id, current as Record<string, unknown>, user.id).catch((err) =>
    console.error('Review revision snapshot failed:', err)
  )

  if (wasApproved && data?.slug) {
    revalidatePath('/')
    revalidatePath('/reviews')
    revalidatePath(`/reviews/${data.slug}`)
  }

  return NextResponse.json({ review: data })
}

// DELETE /api/reviews/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: review } = await admin
    .from('reviews')
    .select('author_id, status')
    .eq('id', id)
    .single()

  if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (review.author_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['draft', 'rejected'].includes(review.status)) {
    return NextResponse.json({ error: 'Only draft or rejected reviews can be deleted' }, { status: 422 })
  }

  const { error } = await admin.from('reviews').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

  revalidatePath('/reviews')
  revalidatePath('/')
  return NextResponse.json({ success: true })
}

// PATCH /api/reviews/[id] — author recalls pending review back to draft
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: review } = await admin
    .from('reviews')
    .select('author_id, status')
    .eq('id', id)
    .single()

  if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (review.author_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (review.status !== 'pending') return NextResponse.json({ error: 'Only pending reviews can be recalled' }, { status: 422 })

  const { error } = await admin.from('reviews').update({ status: 'draft' }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Recall failed' }, { status: 500 })

  revalidatePath('/dashboard/reviews')
  return NextResponse.json({ success: true })
}

// POST /api/reviews/[id]/submit handled via status transition
