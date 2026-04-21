import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeHtml } from '@/lib/sanitize'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { computeReadingTime } from '@/lib/reading-time'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { ModerationResultEmail } from '@/emails/ModerationResultEmail'
import { CATEGORY_SLUGS } from '@/lib/categories'
import * as React from 'react'
import { z } from 'zod'

const CategorySchema = z.enum(CATEGORY_SLUGS as [string, ...string[]])

const UpdateSchema = z.object({
  title: z.string().min(10).max(120).optional(),
  product_name: z.string().min(2).max(120).optional(),
  category: CategorySchema.optional(),
  excerpt: z.string().max(200).optional(),
  content: z.string().min(100).optional(),
  rating: z.number().min(1).max(10).optional(),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
  disclosure_acknowledged: z.boolean().optional(),
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

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ review: data })
}

// PUT /api/reviews/[id] — update draft or moderate (admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

    const { data, error } = await admin.from('reviews').update(updateData).eq('id', id).select('*, author_id').single()
    if (error) return NextResponse.json({ error: 'Moderation action failed' }, { status: 500 })

    revalidatePath('/')
    revalidatePath('/reviews')
    revalidatePath('/about')
    if (data?.slug) revalidatePath(`/reviews/${data.slug}`)

    // Send email notification to author (non-blocking)
    const notifyActions = ['approve', 'reject', 'request_edits'] as const
    if (notifyActions.includes(modParsed.data.action as typeof notifyActions[number]) && data?.author_id) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
      admin.auth.admin.getUserById(data.author_id).then(({ data: authUser }) => {
        const email = authUser?.user?.email
        if (!email) return
        const resend = getResend()
        resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: modParsed.data.action === 'approve'
            ? '🎉 Your review is live on Boss Daddy Life'
            : modParsed.data.action === 'reject'
            ? 'Update on your Boss Daddy submission'
            : 'Edits requested on your Boss Daddy submission',
          react: React.createElement(ModerationResultEmail, {
            action: modParsed.data.action as 'approve' | 'reject' | 'request_edits',
            contentType: 'review',
            title: data.title,
            reason: modParsed.data.rejection_reason,
            siteUrl,
          }),
        }).catch((err: unknown) => console.error('Email send failed:', err))
      }).catch((err: unknown) => console.error('Author lookup failed:', err))
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
  if (parsed.data.rating) updates.rating = parsed.data.rating
  if (parsed.data.pros) updates.pros = parsed.data.pros
  if (parsed.data.cons) updates.cons = parsed.data.cons
  if (typeof parsed.data.disclosure_acknowledged === 'boolean') {
    updates.disclosure_acknowledged = parsed.data.disclosure_acknowledged
  }
  if (parsed.data.content) {
    const sanitized = sanitizeHtml(parsed.data.content)
    updates.content = sanitized
    updates.has_affiliate_links = detectAffiliateLinks(sanitized)
    updates.reading_time_minutes = computeReadingTime(sanitized)
  }

  // Only allow editing drafts or rejected reviews
  const { data, error } = await supabase
    .from('reviews')
    .update(updates)
    .eq('id', id)
    .eq('author_id', user.id)
    .in('status', ['draft', 'rejected'])
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ review: data })
}

// DELETE /api/reviews/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', id)
    .eq('author_id', user.id)
    .in('status', ['draft', 'rejected'])

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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('reviews')
    .update({ status: 'draft' })
    .eq('id', id)
    .eq('author_id', user.id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: 'Recall failed' }, { status: 500 })

  revalidatePath('/dashboard/reviews')
  return NextResponse.json({ success: true })
}

// POST /api/reviews/[id]/submit handled via status transition
