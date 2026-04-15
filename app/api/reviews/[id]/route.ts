import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeHtml } from '@/lib/sanitize'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { z } from 'zod'

const UpdateSchema = z.object({
  title: z.string().min(10).max(120).optional(),
  product_name: z.string().min(2).max(120).optional(),
  content: z.string().min(100).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  disclosure_acknowledged: z.boolean().optional(),
})

const ModerateSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_edits']),
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
    } else {
      updateData.status = 'draft'
      updateData.rejection_reason = modParsed.data.rejection_reason ?? ''
    }

    const { data, error } = await admin.from('reviews').update(updateData).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
  if (parsed.data.rating) updates.rating = parsed.data.rating
  if (typeof parsed.data.disclosure_acknowledged === 'boolean') {
    updates.disclosure_acknowledged = parsed.data.disclosure_acknowledged
  }
  if (parsed.data.content) {
    const sanitized = sanitizeHtml(parsed.data.content)
    updates.content = sanitized
    updates.has_affiliate_links = detectAffiliateLinks(sanitized)
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// POST /api/reviews/[id]/submit handled via status transition
