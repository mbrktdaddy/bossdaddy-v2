import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/auth-cache'
import { TestingNoteUpdateSchema } from '@/lib/products/schema'
import { revalidateProductPaths, revalidateProductReviewPages } from '@/lib/revalidate'

type Params = { params: Promise<{ id: string; noteId: string }> }

// PATCH /api/admin/products/[id]/notes/[noteId] — edit a note's date or text.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id, noteId } = await params
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const parsed = TestingNoteUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
  const updates: { noted_on?: string; body?: string } = {}
  if (parsed.data.noted_on !== undefined) updates.noted_on = parsed.data.noted_on
  if (parsed.data.body !== undefined) updates.body = parsed.data.body
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Scoped to the product too, so a note id can't be edited through another
  // product's URL.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('product_testing_notes')
    .update(updates)
    .eq('id', noteId)
    .eq('product_id', id)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: `Update failed: ${error.message}` }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // The Testing Log shows on the Bench page and, once reviewed, on the review.
  await revalidateProductReviewPages(admin, { id })
  revalidateProductPaths()
  return NextResponse.json({ note: data })
}

// DELETE /api/admin/products/[id]/notes/[noteId]
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id, noteId } = await params
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const admin = createAdminClient()
  const { error } = await admin
    .from('product_testing_notes')
    .delete()
    .eq('id', noteId)
    .eq('product_id', id)

  if (error) return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 })

  await revalidateProductReviewPages(admin, { id })
  revalidateProductPaths()
  return NextResponse.json({ success: true })
}
