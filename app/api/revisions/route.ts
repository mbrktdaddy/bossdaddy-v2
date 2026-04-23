import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { snapshotRevision } from '@/lib/revisions'
import { z } from 'zod'

const ListSchema = z.object({
  content_type: z.enum(['article', 'review']),
  content_id:   z.string().uuid(),
})

const RevertSchema = z.object({
  content_type: z.enum(['article', 'review']),
  content_id:   z.string().uuid(),
  revision_id:  z.string().uuid(),
})

// GET /api/revisions?content_type=article&content_id=uuid — list revisions
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const parsed = ListSchema.safeParse({
    content_type: searchParams.get('content_type'),
    content_id:   searchParams.get('content_id'),
  })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data: revisions } = await admin
    .from('content_revisions')
    .select('id, version_number, created_at, created_by, snapshot, profiles:created_by(username)')
    .eq('content_type', parsed.data.content_type)
    .eq('content_id',   parsed.data.content_id)
    .order('version_number', { ascending: false })
    .limit(50)

  return NextResponse.json({ revisions: revisions ?? [] })
}

// POST /api/revisions — revert content to a specific revision
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = RevertSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { content_type, content_id, revision_id } = parsed.data
  const admin = createAdminClient()

  // Fetch the revision
  const { data: revision } = await admin
    .from('content_revisions')
    .select('snapshot')
    .eq('id', revision_id)
    .eq('content_type', content_type)
    .eq('content_id',   content_id)
    .single()

  if (!revision) return NextResponse.json({ error: 'Revision not found' }, { status: 404 })

  const table = content_type === 'article' ? 'articles' : 'reviews'

  // Snapshot current state FIRST so revert itself creates a restore point
  const { data: currentState } = await admin.from(table).select('*').eq('id', content_id).single()
  if (currentState) {
    await snapshotRevision(content_type, content_id, currentState as Record<string, unknown>, user.id)
  }

  // Build update payload from snapshot — only fields the user would edit
  const snap = revision.snapshot as Record<string, unknown>
  const editableFields = content_type === 'article'
    ? ['title', 'category', 'excerpt', 'content', 'image_url', 'meta_title', 'meta_description']
    : ['title', 'product_name', 'category', 'excerpt', 'content', 'image_url', 'rating', 'pros', 'cons',
       'disclosure_acknowledged', 'meta_title', 'meta_description']

  const updates: Record<string, unknown> = {}
  for (const k of editableFields) {
    if (k in snap) updates[k] = snap[k]
  }

  const { error } = await admin.from(table).update(updates).eq('id', content_id)
  if (error) return NextResponse.json({ error: `Revert failed: ${error.message}` }, { status: 500 })

  return NextResponse.json({ success: true })
}
