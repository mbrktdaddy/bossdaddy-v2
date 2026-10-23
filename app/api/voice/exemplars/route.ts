import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getVoiceExemplars, listExemplarCandidates, MAX_EXEMPLARS, MAX_EXEMPLAR_CHARS } from '@/lib/voiceExemplars'
import { htmlToStructuredText } from '@/lib/content/html'

// Voice exemplars — an authoring tool, gated to authors/admins like the
// lexicon. GET lists the author's approved pieces (candidates) + current picks;
// PUT replaces the picks (≤ MAX_EXEMPLARS) and captures each piece's excerpt.

async function requireAuthor(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'author' && profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null }
  }
  return { error: null, user }
}

export async function GET() {
  const supabase = await createClient()
  const { error: authErr, user } = await requireAuthor(supabase)
  if (authErr) return authErr
  const [picks, candidates] = await Promise.all([getVoiceExemplars(supabase, user.id), listExemplarCandidates(supabase, user.id)])
  return NextResponse.json({ picks, candidates })
}

const PutSchema = z.object({
  picks: z.array(z.object({ type: z.enum(['review', 'guide']), id: z.string().uuid() })).max(MAX_EXEMPLARS),
})

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { error: authErr, user } = await requireAuthor(supabase)
  if (authErr) return authErr

  const body = await request.json().catch(() => null)
  const parsed = PutSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  // Capture the excerpt from the piece as it is NOW — the exemplar is a fixed
  // sample, not a live pointer, so a later edit doesn't quietly change the voice.
  const rows: { user_id: string; content_type: 'review' | 'guide'; content_id: string; title: string; excerpt: string; position: number }[] = []
  for (const [position, pick] of parsed.data.picks.entries()) {
    const table = pick.type === 'review' ? 'reviews' : 'guides'
    const { data } = await supabase.from(table).select('id, title, content, author_id, status').eq('id', pick.id).maybeSingle()
    if (!data || data.author_id !== user.id || data.status !== 'approved') {
      return NextResponse.json({ error: 'Only your own approved pieces can be exemplars.' }, { status: 422 })
    }
    rows.push({
      user_id: user.id,
      content_type: pick.type,
      content_id: data.id,
      title: data.title,
      excerpt: htmlToStructuredText(data.content ?? '').slice(0, MAX_EXEMPLAR_CHARS),
      position,
    })
  }

  const del = await supabase.from('voice_exemplars').delete().eq('user_id', user.id)
  if (del.error) return NextResponse.json({ error: `Could not update exemplars: ${del.error.message}` }, { status: 500 })
  if (rows.length) {
    const ins = await supabase.from('voice_exemplars').insert(rows)
    if (ins.error) return NextResponse.json({ error: `Could not update exemplars: ${ins.error.message}` }, { status: 500 })
  }
  const picks = await getVoiceExemplars(supabase, user.id)
  return NextResponse.json({ picks })
}
