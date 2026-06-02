import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { PHRASE_KINDS, AVOID_CONTEXTS, type VoicePhrase } from '@/lib/voiceLexicon'
import { z } from 'zod'

async function requireAuthor(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'author' && profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null }
  }
  return { error: null, user }
}

// All fields optional — PATCH is used for approve/archive (status only) and for
// editing the phrase itself (text/kind/tone/contexts).
const PatchSchema = z.object({
  text:           z.string().min(2).max(300).transform((s) => s.trim()).optional(),
  kind:           z.enum(PHRASE_KINDS).optional(),
  tone:           z.string().max(120).nullable().transform((v) => v?.trim() || null).optional(),
  contexts_avoid: z.array(z.enum(AVOID_CONTEXTS)).max(AVOID_CONTEXTS.length).optional(),
  status:         z.enum(['proposed', 'approved', 'archived']).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { error: authErr, user } = await requireAuthor(supabase)
  if (authErr) return authErr

  const { success } = await checkRateLimit(`voice:${user.id}`, 'voice')
  if (!success) return NextResponse.json({ error: 'Too many edits. Try again shortly.' }, { status: 429 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // RLS already scopes to the owner; the explicit user_id match is belt-and-braces.
  const { data, error } = await supabase
    .from('voice_phrases')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('PATCH /api/voice/phrases/[id] failed:', error)
    return NextResponse.json({ error: `Update failed: ${error.message}` }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ phrase: data as VoicePhrase })
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { error: authErr, user } = await requireAuthor(supabase)
  if (authErr) return authErr

  const { id } = await params
  const { error } = await supabase
    .from('voice_phrases')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('DELETE /api/voice/phrases/[id] failed:', error)
    return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
