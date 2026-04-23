import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/media/[id] — update alt text
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const altText = typeof body?.alt_text === 'string' ? body.alt_text.trim() : null

  const admin = createAdminClient()

  // Fetch asset to check ownership
  const { data: asset } = await admin
    .from('media_assets')
    .select('uploaded_by')
    .eq('id', id)
    .single()

  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  const isOwner = asset.uploaded_by === user.id

  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: updated, error } = await admin
    .from('media_assets')
    .update({ alt_text: altText })
    .eq('id', id)
    .select('id, url, filename, alt_text')
    .single()

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ asset: updated })
}

// DELETE /api/media/[id] — authors delete own, admins delete any
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: asset } = await admin
    .from('media_assets')
    .select('filename, bucket, uploaded_by')
    .eq('id', id)
    .single()

  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  const isOwner = asset.uploaded_by === user.id

  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Delete from storage
  const { error: storageError } = await admin.storage
    .from(asset.bucket)
    .remove([asset.filename])

  if (storageError) {
    console.error('Media storage delete error:', storageError)
    return NextResponse.json({ error: 'Storage delete failed' }, { status: 502 })
  }

  const { error: dbError } = await admin.from('media_assets').delete().eq('id', id)
  if (dbError) return NextResponse.json({ error: 'DB delete failed' }, { status: 500 })

  return NextResponse.json({ success: true })
}
