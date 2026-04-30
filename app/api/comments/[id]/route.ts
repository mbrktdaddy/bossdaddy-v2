import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const ModerateSchema = z.object({
  action: z.enum(['approve', 'reject']),
})

// PUT /api/comments/[id] — admin approve or reject
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = ModerateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('comments')
    .update({ status: parsed.data.action === 'approve' ? 'approved' : 'rejected' })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Action failed' }, { status: 500 })

  // Revalidate the parent content page so the approved comment appears immediately
  if (parsed.data.action === 'approve' && data) {
    const { content_type, content_id } = data as { content_type: string; content_id: string }
    const table = content_type === 'review' ? 'reviews' : 'guides'
    const { data: content } = await admin.from(table).select('slug').eq('id', content_id).single()
    if (content?.slug) revalidatePath(`/${content_type}s/${content.slug}`)
  }

  return NextResponse.json({ comment: data })
}

// DELETE /api/comments/[id] — own pending comment or admin
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role === 'admin') {
    const admin = createAdminClient()
    await admin.from('comments').delete().eq('id', id)
  } else {
    // Authors can only delete their own non-approved comments
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id)
      .eq('author_id', user.id)
      .neq('status', 'approved')

    if (error) return NextResponse.json({ error: 'Action failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
