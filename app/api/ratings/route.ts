import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const postSchema = z.object({
  review_id: z.string().uuid(),
  rating:    z.number().int().min(1).max(10),
})

async function buildSummary(supabase: Awaited<ReturnType<typeof createClient>>, reviewId: string, authed: boolean) {
  const { data, error } = await supabase.rpc('get_review_rating_summary', { p_review_id: reviewId })
  if (error) return null
  const row = data?.[0]
  return {
    avg:        row?.avg_rating   ?? null,
    count:      Number(row?.rating_count ?? 0),
    userRating: row?.user_rating  ?? null,
    authed,
  }
}

export async function GET(req: NextRequest) {
  const reviewId = req.nextUrl.searchParams.get('review_id')
  if (!reviewId) return NextResponse.json({ error: 'review_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const summary = await buildSummary(supabase, reviewId, !!user)
  if (!summary) return NextResponse.json({ error: 'Failed to load ratings' }, { status: 500 })

  return NextResponse.json(summary)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { review_id, rating } = parsed.data

  const { error: upsertError } = await supabase
    .from('user_ratings')
    .upsert(
      { user_id: user.id, review_id, rating },
      { onConflict: 'user_id,review_id' }
    )

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

  const summary = await buildSummary(supabase, review_id, true)
  if (!summary) return NextResponse.json({ error: 'Failed to load updated ratings' }, { status: 500 })

  return NextResponse.json(summary)
}
