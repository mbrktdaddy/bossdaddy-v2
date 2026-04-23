import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeHtml } from '@/lib/sanitize'
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
  title: z.string().min(10).max(120).optional(),
  category: CategorySchema.optional(),
  excerpt: z.string().max(200).optional(),
  content: z.string().min(100).optional(),
  image_url: z.string().url().optional().nullable(),
})

// GET /api/articles/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .single()

  if (!error) return NextResponse.json({ article: data })

  // RLS may block pending articles from non-authors — bypass for admins
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'admin') {
      const admin = createAdminClient()
      const { data: adminData, error: adminErr } = await admin.from('articles').select('*').eq('id', id).single()
      if (!adminErr) return NextResponse.json({ article: adminData })
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

// PUT /api/articles/[id] — admin moderation or author edit
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
      const { data: current } = await admin.from('articles').select('is_visible').eq('id', id).single()
      updateData.is_visible = !(current?.is_visible ?? true)
    } else if (modParsed.data.action === 'reject') {
      updateData.status = 'rejected'
      updateData.rejection_reason = modParsed.data.rejection_reason ?? ''
    } else {
      // request_edits
      updateData.status = 'draft'
      updateData.rejection_reason = modParsed.data.rejection_reason ?? ''
    }

    const { data, error } = await admin.from('articles').update(updateData).eq('id', id).select('*, author_id').single()
    if (error) return NextResponse.json({ error: 'Moderation action failed' }, { status: 500 })

    revalidatePath('/')
    revalidatePath('/articles')
    revalidatePath('/about')
    if (data?.slug) revalidatePath(`/articles/${data.slug}`)

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
            ? '🎉 Your article is live on Boss Daddy Life'
            : modParsed.data.action === 'reject'
            ? 'Update on your Boss Daddy submission'
            : 'Edits requested on your Boss Daddy submission',
          react: React.createElement(ModerationResultEmail, {
            action: modParsed.data.action as 'approve' | 'reject' | 'request_edits',
            contentType: 'article',
            title: data.title,
            reason: modParsed.data.rejection_reason,
            siteUrl,
          }),
        }).catch((err: unknown) => console.error('Email send failed:', err))
      }).catch((err: unknown) => console.error('Author lookup failed:', err))
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
  if (parsed.data.content) {
    const sanitized = sanitizeHtml(parsed.data.content)
    updates.content = sanitized
    updates.reading_time_minutes = computeReadingTime(sanitized)
  }

  // Only allow editing drafts or rejected articles
  const { data, error } = await supabase
    .from('articles')
    .update(updates)
    .eq('id', id)
    .eq('author_id', user.id)
    .in('status', ['draft', 'rejected'])
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ article: data })
}

// DELETE /api/articles/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('id', id)
    .eq('author_id', user.id)
    .in('status', ['draft', 'rejected'])

  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

  revalidatePath('/articles')
  revalidatePath('/')
  return NextResponse.json({ success: true })
}

// PATCH /api/articles/[id] — author recalls pending article back to draft
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('articles')
    .update({ status: 'draft' })
    .eq('id', id)
    .eq('author_id', user.id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: 'Recall failed' }, { status: 500 })

  revalidatePath('/dashboard/articles')
  return NextResponse.json({ success: true })
}
