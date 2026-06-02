import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getAllPhrases, PHRASE_KINDS, AVOID_CONTEXTS, type VoicePhrase } from '@/lib/voiceLexicon'
import { z } from 'zod'

// Voice lexicon is an authoring tool — gate to authors/admins, same as the
// voice profile. Members never draft content, so they have no lexicon.
async function requireAuthor(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'author' && profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null }
  }
  return { error: null, user }
}

const CreateSchema = z.object({
  text:             z.string().min(2).max(300).transform((s) => s.trim()),
  kind:             z.enum(PHRASE_KINDS).default('phrase'),
  tone:             z.string().max(120).optional().nullable().transform((v) => v?.trim() || null),
  contexts_avoid:   z.array(z.enum(AVOID_CONTEXTS)).max(AVOID_CONTEXTS.length).default([]),
  source_review_id: z.string().uuid().optional().nullable().transform((v) => v ?? null),
  // Explicit one-click capture from the editor → born approved (the click IS
  // the approval). Anything else (future auto-mining) defaults to proposed.
  capture:          z.boolean().default(false),
})

export async function GET() {
  const supabase = await createClient()
  const { error: authErr, user } = await requireAuthor(supabase)
  if (authErr) return authErr

  const phrases = await getAllPhrases(supabase, user.id)
  return NextResponse.json({ phrases })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { error: authErr, user } = await requireAuthor(supabase)
  if (authErr) return authErr

  const { success } = await checkRateLimit(`voice:${user.id}`, 'voice')
  if (!success) return NextResponse.json({ error: 'Too many saves. Try again shortly.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { text, kind, tone, contexts_avoid, source_review_id, capture } = parsed.data

  // De-dupe: if this exact phrase already exists (any status), bump it back to
  // approved on an explicit capture instead of creating a duplicate row.
  const { data: existing } = await supabase
    .from('voice_phrases')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('text', text)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('voice_phrases')
      .update({
        status: capture ? 'approved' : existing.status,
        kind, tone, contexts_avoid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) {
      console.error('POST /api/voice/phrases (dedupe update) failed:', error)
      return NextResponse.json({ error: `Save failed: ${error.message}` }, { status: 500 })
    }
    return NextResponse.json({ phrase: data as VoicePhrase, deduped: true })
  }

  const { data, error } = await supabase
    .from('voice_phrases')
    .insert({
      user_id: user.id,
      text, kind, tone, contexts_avoid, source_review_id,
      status: capture ? 'approved' : 'proposed',
    })
    .select()
    .single()

  if (error) {
    console.error('POST /api/voice/phrases failed:', error)
    return NextResponse.json({ error: `Save failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ phrase: data as VoicePhrase })
}
