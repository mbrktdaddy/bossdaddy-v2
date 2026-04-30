import { NextResponse, type NextRequest, after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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

const ModerateSchema = z.object({
  action: z.enum(['approve', 'unpublish', 'toggle_visibility', 'reject', 'request_edits']),
  rejection_reason: z.string().optional(),
})

const UpdateSchema = z.object({
  title:                z.string().min(10).max(120).optional(),
  category:             CategorySchema.optional(),
  excerpt:              z.string().max(200).optional(),
  content:              z.string().min(100).optional(),
  image_url:            z.string().url().optional().nullable(),
  meta_title:           z.string().max(70).optional().nullable(),
  meta_description:     z.string().max(200).optional().nullable(),
  scheduled_publish_at: z.string().datetime().optional().nullable(),
})

// GET /api/guides/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('guides')
    .select('*')
    .eq('id', id)
    .single()

  if (!error) return NextResponse.json({ article: data })

  // RLS may block pending guides from non-authors — bypass for admins
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'admin') {
      const admin = createAdminClient()
      const { data: adminData, error: adminErr } = await admin.from('guides').select('*').eq('id', id).single()
      if (!adminErr) return NextResponse.json({ article: adminData })
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

// PUT /api/guides/[id] — admin moderation or author edit
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)

  // ── Admin moderation action ──────────────────────────────────────────────
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
    } else if (modParsed.data.action === 'unpublish') {
      updateData.status = 'draft'
      updateData.published_at = null
    } else if (modParsed.data.action === 'toggle_visibility') {
      const { data: current } = await admin.from('guides').select('is_visible').eq('id', id).single()
      updateData.is_visible = !(current?.is_visible ?? true)
    } else if (modParsed.data.action === 'reject') {
      updateData.status = 'rejected'
      updateData.rejection_reason = modParsed.data.rejection_reason ?? ''
    } else {
      // request_edits
      updateData.status = 'draft'
      updateData.rejection_reason = modParsed.data.rejection_reason ?? ''
    }

    const { data, error } = await admin.from('guides').update(updateData).eq('id', id).select('*').single()
    if (error) {
      console.error('Guide moderation update failed:', error)
      return NextResponse.json({ error: `Moderation action failed: ${error.message}` }, { status: 500 })
    }

    revalidatePath('/')
    revalidatePath('/guides')
    revalidatePath('/about')
    if (data?.slug) revalidatePath(`/guides/${data.slug}`)

    // Send email notification — scheduled via after() so it doesn't block the response
    const notifyActions = ['approve', 'reject', 'request_edits'] as const
    if (notifyActions.includes(modParsed.data.action as typeof notifyActions[number]) && data?.author_id && process.env.RESEND_API_KEY) {
      const authorId = data.author_id as string
      const action = modParsed.data.action as 'approve' | 'reject' | 'request_edits'
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
      const articleTitle = data.title as string
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
              subject: action === 'approve' ? '🎉 Your guide is live on Boss Daddy Life'
                : action === 'reject' ? 'Update on your Boss Daddy submission'
                : 'Edits requested on your Boss Daddy submission',
              react: React.createElement(ModerationResultEmail, {
                action, contentType: 'guide', title: articleTitle,
                reason: rejectionReason, siteUrl,
              }),
            })
          } catch (err) { console.error('Guide notification failed:', err) }
        })
      } catch (err) { console.error('after() registration failed (guide):', err) }
    }

    return NextResponse.json({ article: data })
  }

  // ── Author update ────────────────────────────────────────────────────────
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (parsed.data.title) updates.title = parsed.data.title
  if (parsed.data.category) updates.category = parsed.data.category
  if (parsed.data.excerpt !== undefined) updates.excerpt = parsed.data.excerpt
  if (parsed.data.image_url !== undefined) updates.image_url = parsed.data.image_url
  if (parsed.data.meta_title !== undefined) updates.meta_title = parsed.data.meta_title
  if (parsed.data.meta_description !== undefined) updates.meta_description = parsed.data.meta_description
  if (parsed.data.scheduled_publish_at !== undefined) updates.scheduled_publish_at = parsed.data.scheduled_publish_at
  if (parsed.data.content) {
    const resolved = await resolveProductTokens(parsed.data.content, supabase)
    const sanitized = sanitizeHtml(resolved)
    updates.content = sanitized
    updates.reading_time_minutes = computeReadingTime(sanitized)
    updates.has_affiliate_links = detectAffiliateLinks(sanitized)
  }

  // Use admin client — verify ownership + status manually to avoid RLS silent failures
  const admin = createAdminClient()
  const { data: current } = await admin.from('guides').select('*').eq('id', id).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Admin can edit any guide at any status; authors only their own drafts/rejected
  const { data: profileForUpdate } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdminEditor = profileForUpdate?.role === 'admin'

  if (!isAdminEditor) {
    if (current.author_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!['draft', 'rejected'].includes(current.status)) {
      return NextResponse.json({ error: 'Only draft or rejected guides can be edited' }, { status: 422 })
    }
  }

  // When an admin edits a live guide, revalidate the public pages too
  const wasApproved = current.status === 'approved'

  const { data, error } = await admin.from('guides').update(updates).eq('id', id).select().single()
  if (error) {
    console.error('Guide author/admin update failed:', error)
    return NextResponse.json({ error: `Update failed: ${error.message}` }, { status: 500 })
  }

  // Snapshot the PREVIOUS state for version history (fire-and-forget; don't block response)
  snapshotRevision('guide', id, current as Record<string, unknown>, user.id).catch((err) =>
    console.error('Guide revision snapshot failed:', err)
  )

  if (wasApproved && data?.slug) {
    revalidatePath('/')
    revalidatePath('/guides')
    revalidatePath(`/guides/${data.slug}`)
  }

  return NextResponse.json({ article: data })
}

// DELETE /api/guides/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use admin client to bypass RLS; enforce ownership + status manually
  const admin = createAdminClient()
  const { data: article } = await admin
    .from('guides')
    .select('author_id, status')
    .eq('id', id)
    .single()

  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (article.author_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['draft', 'rejected'].includes(article.status)) {
    return NextResponse.json({ error: 'Only draft or rejected guides can be deleted' }, { status: 422 })
  }

  const { error } = await admin.from('guides').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

  revalidatePath('/guides')
  revalidatePath('/')
  return NextResponse.json({ success: true })
}

// PATCH /api/guides/[id] — author recalls pending guide back to draft
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: article } = await admin
    .from('guides')
    .select('author_id, status')
    .eq('id', id)
    .single()

  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (article.author_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (article.status !== 'pending') return NextResponse.json({ error: 'Only pending guides can be recalled' }, { status: 422 })

  const { error } = await admin.from('guides').update({ status: 'draft' }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Recall failed' }, { status: 500 })

  revalidatePath('/dashboard/guides')
  return NextResponse.json({ success: true })
}
