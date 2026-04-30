import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { emptyVoiceProfile, type VoiceProfile } from '@/lib/voiceProfile'
import { z } from 'zod'

const FactSchema = z.object({
  id:    z.string().min(1).max(64),
  label: z.string().max(120).default(''),
  value: z.string().max(2000).default(''),
})

// Accept empty strings from the form and normalize them to null so the DB
// doesn't carry whitespace-only rows.
const nullableText = (max: number) =>
  z.string().max(max).optional().nullable().transform((v) => {
    if (v === undefined || v === null) return null
    const s = v.trim()
    return s === '' ? null : s
  })

const nullableDate = z.string().optional().nullable().transform((v) => {
  if (!v) return null
  // Accept 'YYYY-MM-DD'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return v
})

const UpsertSchema = z.object({
  self_dob:     nullableDate,
  wife_dob:     nullableDate,
  daughter_dob: nullableDate,
  occupation:   nullableText(500),
  faith_values: nullableText(1000),
  region:       nullableText(200),
  facts:        z.array(FactSchema).max(100).default([]),
})

export async function GET() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('voice_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) {
    console.error('GET /api/voice-profile failed:', error)
    return NextResponse.json({ error: `Load failed: ${error.message}` }, { status: 500 })
  }

  // Return an empty-shape response if no row exists yet — lets the form
  // render without a dedicated "not found" branch.
  const profile: VoiceProfile | null = (data as VoiceProfile | null) ?? null
  return NextResponse.json({ profile: profile ?? { user_id: user.id, ...emptyVoiceProfile() } })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = UpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  // Drop empty facts server-side too — the client may submit blank rows mid-edit.
  const facts = parsed.data.facts.filter((f) => f.value?.trim() || f.label?.trim())

  const { data, error } = await supabase
    .from('voice_profiles')
    .upsert(
      { user_id: user.id, ...parsed.data, facts },
      { onConflict: 'user_id' },
    )
    .select()
    .single()

  if (error) {
    console.error('PUT /api/voice-profile failed:', error)
    return NextResponse.json({ error: `Save failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ profile: data as unknown as VoiceProfile })
}
