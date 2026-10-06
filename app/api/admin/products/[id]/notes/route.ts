import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/auth-cache'
import { TestingNoteCreateSchema } from '@/lib/products/schema'
import { revalidateProductPaths, revalidateProductReviewPages } from '@/lib/revalidate'

// Testing notes (mig 158): dated public field notes on a product under test.

// GET /api/admin/products/[id]/notes — every note on the product, newest first.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const { data, error } = await createAdminClient()
    .from('product_testing_notes')
    .select('*')
    .eq('product_id', id)
    .order('noted_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: `List failed: ${error.message}` }, { status: 500 })
  return NextResponse.json({ notes: data ?? [] })
}

// POST /api/admin/products/[id]/notes — add a note.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const parsed = TestingNoteCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('product_testing_notes')
    .insert({ product_id: id, noted_on: parsed.data.noted_on, body: parsed.data.body })
    .select()
    .single()

  if (error) {
    // 23503 = the product doesn't exist (FK).
    if (error.code === '23503') return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    return NextResponse.json({ error: `Create failed: ${error.message}` }, { status: 500 })
  }

  // The Testing Log shows on the Bench page and, once reviewed, on the review.
  await revalidateProductReviewPages(admin, { id })
  revalidateProductPaths()
  return NextResponse.json({ note: data }, { status: 201 })
}
