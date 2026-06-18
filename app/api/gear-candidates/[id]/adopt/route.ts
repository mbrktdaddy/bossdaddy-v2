import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/gear-candidates/[id]/adopt — promote a researched candidate into the
// product spine (admin only). This is the deliberate "editorial firewall" bridge:
// a candidate (AI-researched, never public) becomes a real bench item only when an
// admin chooses to adopt it. Sets the new product to status='considering' with
// source='adopted_from_research', and FLAGS the candidate (adopted_at +
// adopted_product_id) rather than deleting it, preserving provenance.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: candidate } = await admin
    .from('gear_candidates')
    .select('*')
    .eq('id', id)
    .single()

  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (candidate.adopted_at) {
    return NextResponse.json(
      { error: 'Already adopted', product_id: candidate.adopted_product_id },
      { status: 409 },
    )
  }

  // If a product with this slug already exists (e.g. hand-added later), link to it
  // instead of creating a duplicate; otherwise create the bench row.
  const { data: existing } = await admin
    .from('products')
    .select('id, slug')
    .eq('slug', candidate.slug)
    .maybeSingle()

  let productId = existing?.id ?? null
  if (!productId) {
    const { data: created, error: insertError } = await admin
      .from('products')
      .insert({
        slug:          candidate.slug,
        name:          candidate.name,
        brand:         candidate.brand,
        category:      candidate.category,
        affiliate_url: candidate.affiliate_url,
        store:         candidate.store,
        status:        'considering',
        source:        'adopted_from_research',
      })
      .select('id')
      .single()
    if (insertError || !created) {
      return NextResponse.json({ error: insertError?.message ?? 'Adopt failed' }, { status: 500 })
    }
    productId = created.id
  }

  // Flag the candidate as adopted (keep the row for provenance).
  await admin
    .from('gear_candidates')
    .update({ adopted_at: new Date().toISOString(), adopted_product_id: productId })
    .eq('id', id)

  revalidatePath('/bench')
  revalidatePath('/gear')
  revalidatePath('/')

  return NextResponse.json({ product_id: productId, slug: candidate.slug }, { status: 201 })
}
