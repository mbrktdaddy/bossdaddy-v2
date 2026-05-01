import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const CreateSchema = z.object({
  slug:                   z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  title:                  z.string().min(2).max(160),
  description:            z.string().max(1000).optional().nullable(),
  image_url:              z.string().url().max(2048).optional().nullable(),
  affiliate_url:          z.string().url().max(2048).optional().nullable(),
  store:                  z.string().max(40).optional().nullable(),
  custom_store_name:      z.string().max(80).optional().nullable(),
  asin:                   z.string().max(20).optional().nullable(),
  status:                 z.enum(['considering','queued','testing','reviewed','skipped']).default('considering'),
  skip_reason:            z.string().max(500).optional().nullable(),
  estimated_review_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  priority:               z.number().int().default(0),
})

// GET /api/wishlist — public list with vote counts
export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('wishlist_items')
    .select(`
      *,
      vote_count:wishlist_votes(count)
    `)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = (data ?? []).map((item: Record<string, unknown>) => ({
    ...item,
    vote_count: (item.vote_count as { count: number }[])?.[0]?.count ?? 0,
  }))

  return NextResponse.json({ items })
}

// POST /api/wishlist — admin create
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('wishlist_items')
    .insert({
      slug:                   parsed.data.slug,
      title:                  parsed.data.title,
      description:            parsed.data.description ?? null,
      image_url:              parsed.data.image_url ?? null,
      affiliate_url:          parsed.data.affiliate_url ?? null,
      store:                  parsed.data.store ?? null,
      custom_store_name:      parsed.data.custom_store_name ?? null,
      asin:                   parsed.data.asin ?? null,
      status:                 parsed.data.status,
      skip_reason:            parsed.data.skip_reason ?? null,
      estimated_review_date:  parsed.data.estimated_review_date ?? null,
      priority:               parsed.data.priority,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePath('/bench')
  revalidatePath('/')

  return NextResponse.json({ item: data }, { status: 201 })
}
