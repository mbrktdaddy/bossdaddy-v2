import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/auth-cache'
import { OCCASIONS } from '@/lib/gift-occasions'
import { sanitizeHtml } from '@/lib/sanitize'
import { CollectionUpdateSchema } from '@/lib/collections/schema'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const admin = createAdminClient()
  const [{ data: pick }, { data: items }] = await Promise.all([
    admin.from('collections').select('*').eq('id', id).single(),
    admin.from('collection_items')
      .select('id, review_id, position, blurb, wins_category, role_label, best_for, reviews(id, slug, title, product_name, category, rating, image_url)')
      .eq('collection_id', id)
      .order('position'),
  ])

  if (!pick) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ pick, items: items ?? [] })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => null)
  const parsed = CollectionUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { items, ...meta } = parsed.data
  const admin = createAdminClient()

  // Publish gate: prevent setting is_visible=true on a collection that doesn't
  // have enough items for its type to render meaningfully. Comparisons need a
  // head-to-head (≥ 2 contenders), stacks need at least one piece of kit.
  if (meta.is_visible === true) {
    const { data: existing } = await admin
      .from('collections')
      .select('collection_type')
      .eq('id', id)
      .single()
    const type = existing?.collection_type ?? 'general'
    const minItems = type === 'comparison' ? 2 : type === 'stack' ? 1 : 0
    if (minItems > 0) {
      // Use the items in the body if provided (they're about to replace what's
      // in the DB); otherwise count what's already saved.
      const itemCount = items !== undefined
        ? items.length
        : (await admin.from('collection_items').select('id', { count: 'exact', head: true }).eq('collection_id', id)).count ?? 0
      if (itemCount < minItems) {
        return NextResponse.json(
          { error: `A ${type} needs at least ${minItems} item${minItems === 1 ? '' : 's'} before it can be published.` },
          { status: 422 }
        )
      }
    }
  }

  if (Object.keys(meta).length > 0) {
    const payload: Record<string, unknown> = { ...meta }
    // User-authored HTML — sanitize before it's ever rendered raw on public pages.
    if (typeof payload.intro_html === 'string') payload.intro_html = sanitizeHtml(payload.intro_html)
    if (typeof payload.methodology_html === 'string') payload.methodology_html = sanitizeHtml(payload.methodology_html)
    if (meta.is_visible && !meta.published_at) {
      const { data: existing } = await admin.from('collections').select('published_at').eq('id', id).single()
      if (!existing?.published_at) payload.published_at = new Date().toISOString()
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await admin.from('collections').update(payload as any).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (items !== undefined) {
    await admin.from('collection_items').delete().eq('collection_id', id)
    if (items.length > 0) {
      const rows = items.map((item) => ({ collection_id: id, ...item }))
      const { error } = await admin.from('collection_items').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { data: pick } = await admin.from('collections').select('*').eq('id', id).single()
  revalidatePath('/picks')
  revalidatePath('/gifts')
  revalidatePath('/comparisons')
  revalidatePath('/stacks')
  revalidatePath('/')
  if (pick?.slug) {
    if (pick.collection_type === 'comparison') revalidatePath(`/comparisons/${pick.slug}`)
    else if (pick.collection_type === 'stack') revalidatePath(`/stacks/${pick.slug}`)
    else revalidatePath(`/picks/${pick.slug}`)
  }
  if (pick?.occasion) {
    const occ = OCCASIONS.find((o) => o.value === pick.occasion)
    if (occ) revalidatePath(`/gifts/${occ.slug}`)
  }

  // Revalidate any review page whose ID is currently in this collection so the
  // <CollectionsForReview> cross-link strip refreshes immediately.
  const { data: linkedReviewIds } = await admin
    .from('collection_items')
    .select('review_id')
    .eq('collection_id', id)
  // Product-only items (mig 110) have a null review_id — drop them; only
  // review-backed cross-links need their /reviews/[slug] page revalidated.
  const reviewIds = (linkedReviewIds ?? [])
    .map((r) => r.review_id)
    .filter((x): x is string => x !== null)
  if (reviewIds.length > 0) {
    const { data: reviewRows } = await admin
      .from('reviews')
      .select('slug')
      .in('id', reviewIds)
    for (const r of (reviewRows ?? [])) {
      if (r.slug) revalidatePath(`/reviews/${r.slug}`)
    }
  }

  return NextResponse.json({ pick })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const admin = createAdminClient()
  const { error } = await admin.from('collections').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/picks')
  revalidatePath('/gifts')
  revalidatePath('/comparisons')
  revalidatePath('/stacks')
  revalidatePath('/')
  return NextResponse.json({ success: true })
}
