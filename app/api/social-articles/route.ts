import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { serializeForX } from '@/lib/x/serialize'
import { requireSocialActor } from '@/lib/social/generate'
import { z } from 'zod'

// X Studio Phase 5 — persistence for long-form X Articles (social_articles).
// Owner-scoped (Pattern B) tables; admin-only FEATURE gate via requireSocialActor.
// body_html is generic HTML; the X-specific serializer runs on every write so the
// stored dropped_tags report and the returned x_html preview stay in sync.

const LIST_SELECT = 'id, title, cover_image_url, source_type, source_id, source_title, status, scheduled_at, external_url, posted_at, created_at, updated_at'
const FULL_SELECT = 'id, title, body_html, cover_image_url, source_type, source_id, source_title, status, dropped_tags, scheduled_at, external_id, external_url, posted_via, posted_at, created_at, updated_at'

// GET /api/social-articles?status=draft — list the user's articles (summary).
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const actor = await requireSocialActor(supabase)
  if (actor.error) return actor.error
  const user = actor.user

  const status = new URL(request.url).searchParams.get('status')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from('social_articles')
    .select(LIST_SELECT)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error: dbErr } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ articles: data ?? [] })
}

const CreateSchema = z.object({
  title:        z.string().min(1).max(300),
  body_html:    z.string().max(100_000).optional().default(''),
  cover_image_url: z.string().url().optional().nullable(),
  source_type:  z.enum(['review', 'guide', 'original', 'collection']).optional(),
  source_id:    z.string().uuid().optional(),
  source_title: z.string().max(300).optional(),
})

// POST /api/social-articles — create a draft article.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const actor = await requireSocialActor(supabase)
  if (actor.error) return actor.error
  const user = actor.user

  const body = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { html: x_html, dropped } = serializeForX(parsed.data.body_html)

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbErr } = await (admin as any)
    .from('social_articles')
    .insert({ ...parsed.data, user_id: user.id, status: 'draft', dropped_tags: dropped })
    .select(FULL_SELECT)
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ article: data, x_html, dropped }, { status: 201 })
}
