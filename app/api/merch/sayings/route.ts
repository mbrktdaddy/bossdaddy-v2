import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { generateMerchSayings } from '@/lib/merch/sayings'
import { classifyClaudeError } from '@/lib/ai/errors'

export const runtime = 'nodejs'

const BodySchema = z.object({
  theme: z.string().min(2).max(500),
  count: z.number().int().min(1).max(20).optional(),
})

async function requireAdmin() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const rl = await checkRateLimit(auth.user.id, 'merch-sayings')
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit reached. Try again later.', reset: rl.reset },
      { status: 429 },
    )
  }

  try {
    const sayings = await generateMerchSayings({ theme: parsed.data.theme, count: parsed.data.count })
    if (sayings.length === 0) {
      return NextResponse.json({ error: 'No sayings generated. Try a different theme.' }, { status: 502 })
    }
    return NextResponse.json({ sayings })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('[merch/sayings] generation failed:', c.kind, '-', c.detail)
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}
