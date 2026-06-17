import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

// "Notify me when the Boss tests one" — the close-the-loop capture for a
// researched (not-tested) pick from research_gear. Writes to boss_research_notify
// (public-insert RLS, admin-read); admins batch the "we tested it" emails later.
export const runtime = 'nodejs'

const BodySchema = z.object({
  email: z.string().trim().email().max(200),
  productSlug: z.string().trim().max(80).optional(),
  query: z.string().trim().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
  const { success } = await checkRateLimit(`boss-notify:${ip}`, 'boss-notify')
  if (!success) {
    return NextResponse.json({ error: 'Too many requests — try again in a bit.' }, { status: 429 })
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 })
  }
  const { email, productSlug, query } = parsed.data

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  const { error } = await supabase.from('boss_research_notify').insert({
    user_id: user?.id ?? null,
    email,
    product_slug: productSlug ?? null,
    query: query ?? null,
  })
  if (error) {
    return NextResponse.json({ error: 'Could not save that right now.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
