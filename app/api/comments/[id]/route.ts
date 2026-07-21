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

  // Revalidate the parent content page so the change is reflected immediately —
  // on BOTH approve (comment appears) and reject (comment is removed).
  if (data) {
    const { content_type, content_id } = data as { content_type: string; content_id: string }
    const tableMap  = { review: 'reviews', guide: 'guides', product: 'products' } as const
    const prefixMap = { review: '/reviews', guide: '/guides', product: '/bench' } as const
    const table  = tableMap[content_type as keyof typeof tableMap]
    const prefix = prefixMap[content_type as keyof typeof prefixMap]
    if (table && prefix) {
      const { data: content } = await admin.from(table).select('slug').eq('id', content_id).single()
      if (content?.slug) revalidatePath(`${prefix}/${content.slug}`)
    }
  }

  return NextResponse.json({ comment: data })
}

// DELETE /api/comments/[id] — own comment (any status) or admin
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  // Grab the parent-content coordinates (returned by the delete) so we can flush
  // the public page cache afterward.
  let deleted: { content_type: string; content_id: string } | null = null

  if (profile?.role === 'admin') {
    const admin = createAdminClient()
    const { data } = await admin
      .from('comments')
      .delete()
      .eq('id', id)
      .select('content_type, content_id')
      .maybeSingle()
    deleted = data ?? null
  } else {
    // Authors can delete their OWN comment regardless of status (RLS enforces
    // ownership too — see migration 123). If nothing comes back, the comment
    // wasn't theirs (or is already gone) → 404, not a silent success.
    const { data, error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id)
      .eq('author_id', user.id)
      .select('content_type, content_id')
      .maybeSingle()

    if (error) return NextResponse.json({ error: 'Action failed' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    deleted = data
  }

  // Flush the parent content page so the removed comment disappears immediately.
  if (deleted) {
    const tableMap  = { review: 'reviews', guide: 'guides', product: 'products' } as const
    const prefixMap = { review: '/reviews', guide: '/guides', product: '/bench' } as const
    const table  = tableMap[deleted.content_type as keyof typeof tableMap]
    const prefix = prefixMap[deleted.content_type as keyof typeof prefixMap]
    if (table && prefix) {
      const admin = createAdminClient()
      const { data: content } = await admin.from(table).select('slug').eq('id', deleted.content_id).single()
      if (content?.slug) revalidatePath(`${prefix}/${content.slug}`)
    }
  }

  return NextResponse.json({ success: true })
}
