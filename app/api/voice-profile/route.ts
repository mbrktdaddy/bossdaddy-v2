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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return v
})

const nullableGender = z.enum(['male', 'female', 'other'])
  .optional()
  .nullable()
  .transform((v) => v ?? null)

const FamilyMemberSchema = z.object({
  id:           z.string().min(1).max(64),
  relationship: z.string().max(80).default(''),
  name:         nullableText(80),
  dob:          nullableDate,
  gender:       nullableGender,
})

const UpsertSchema = z.object({
  family_members: z.array(FamilyMemberSchema).max(20).default([]),
  occupation:     nullableText(1500),
  faith_values:   nullableText(1000),
  region:         nullableText(200),
  facts:          z.array(FactSchema).max(100).default([]),
})

// Voice profiles only exist to inform Claude when an author drafts content.
// Members have no drafting permissions, so the role gate here matches the UI
// gate in /dashboard/profile (the link is hidden for members anyway).
async function requireAuthorRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'author' && profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null }
  }
  return { error: null, user }
}

export async function GET() {
  const supabase = await createClient()
  const { error: authErr, user } = await requireAuthorRole(supabase)
  if (authErr) return authErr

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
  const { error: authErr, user } = await requireAuthorRole(supabase)
  if (authErr) return authErr

  const body = await request.json().catch(() => null)
  const parsed = UpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  // Drop empty rows server-side — the client may submit blank entries mid-edit.
  const facts = parsed.data.facts.filter((f) => f.value?.trim() || f.label?.trim())
  const family_members = parsed.data.family_members.filter(
    (m) => m.relationship?.trim() || m.name || m.dob,
  )

  const { data, error } = await supabase
    .from('voice_profiles')
    .upsert(
      { user_id: user.id, ...parsed.data, facts, family_members },
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
