import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/auth-cache'
import { sanitizeHtml } from '@/lib/sanitize'
import { PickListSchema } from '@/lib/collections/schema'

export async function GET() {
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('collections')
    .select('id, slug, title, description, hero_image_url, is_visible, published_at, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ picks: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => null)
  const parsed = PickListSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const insertPayload = {
    ...parsed.data,
    // User-authored HTML — sanitize before it's ever rendered raw on public pages.
    intro_html:       parsed.data.intro_html ? sanitizeHtml(parsed.data.intro_html) : parsed.data.intro_html,
    methodology_html: parsed.data.methodology_html ? sanitizeHtml(parsed.data.methodology_html) : parsed.data.methodology_html,
    published_at:     parsed.data.is_visible ? (parsed.data.published_at ?? new Date().toISOString()) : null,
  }
  const { data, error } = await admin
    .from('collections')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePath('/picks')
  revalidatePath('/gifts')
  revalidatePath('/')
  if (parsed.data.occasion) {
    const { OCCASIONS } = await import('@/lib/gift-occasions')
    const occasionConfig = OCCASIONS.find((o) => o.value === parsed.data.occasion)
    if (occasionConfig) revalidatePath(`/gifts/${occasionConfig.slug}`)
  }
  return NextResponse.json({ pick: data }, { status: 201 })
}
