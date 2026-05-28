'use server'

// Kid moments (the "Log") + Weekends Until intent events.
//
// Moments are authenticated-only — kid_moments.user_id is NOT NULL. Anonymous
// users see a "Sign in to capture moments" affordance instead. Intent events
// support both anonymous and authenticated, via the admin client.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateAnonymousId } from './cookies'

const MomentKindSchema = z.enum([
  'general', 'weekend', 'monthly_interest', 'quote', 'milestone',
])

const AddMomentSchema = z.object({
  kid_profile_id: z.string().uuid(),
  response: z.string().trim().min(1, 'Tell us what happened').max(2000),
  moment_kind: MomentKindSchema.optional(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
})

export type MomentActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export type KidMoment = {
  id: string
  kid_profile_id: string
  moment_kind: 'general' | 'weekend' | 'monthly_interest' | 'quote' | 'milestone'
  occurred_on: string | null
  response: string
  photo_url: string | null
  created_at: string
  updated_at: string
}

const MOMENT_COLUMNS =
  'id, kid_profile_id, moment_kind, occurred_on, response, photo_url, created_at, updated_at'

export async function addMoment(
  input: z.input<typeof AddMomentSchema>,
): Promise<MomentActionResult<{ id: string }>> {
  const parsed = AddMomentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) {
    return { ok: false, error: 'Sign in to capture moments' }
  }

  const { data, error } = await supabase.from('kid_moments')
    .insert({
      user_id: user.id,
      kid_profile_id: parsed.data.kid_profile_id,
      response: parsed.data.response,
      moment_kind: parsed.data.moment_kind ?? 'general',
      occurred_on: parsed.data.occurred_on ?? null,
      photo_url: parsed.data.photo_url ?? null,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  // Every surface that reads from kid_moments. Keep in sync with deleteMoment.
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  revalidatePath('/account/settings')
  revalidatePath('/tools')
  revalidatePath('/tools/kids/[id]', 'page')
  revalidatePath('/tools/weekends-until')
  return { ok: true, data: { id: data.id as string } }
}

export async function listMomentsForKid(
  kidProfileId: string,
  limit: number = 5,
): Promise<KidMoment[]> {
  const parsed = z.string().uuid().safeParse(kidProfileId)
  if (!parsed.success) return []

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return []

  const { data } = await supabase.from('kid_moments')
    .select(MOMENT_COLUMNS)
    .eq('kid_profile_id', parsed.data)
    .order('occurred_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as KidMoment[]
}

export async function countMomentsForKid(kidProfileId: string): Promise<number> {
  const parsed = z.string().uuid().safeParse(kidProfileId)
  if (!parsed.success) return 0

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return 0

  const { count } = await supabase.from('kid_moments')
    .select('id', { count: 'exact', head: true })
    .eq('kid_profile_id', parsed.data)

  return (count as number | null) ?? 0
}

export async function deleteMoment(id: string): Promise<MomentActionResult> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Invalid id' }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }

  const { error } = await supabase.from('kid_moments')
    .delete()
    .eq('id', parsed.data)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }

  // Every surface that reads from kid_moments. Keep in sync with addMoment.
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  revalidatePath('/account/settings')
  revalidatePath('/tools')
  revalidatePath('/tools/kids/[id]', 'page')
  revalidatePath('/tools/weekends-until')
  return { ok: true }
}

// ── Intent events (Weekends Until usage tracking) ────────────────────────────

const RecordWeekendsRunSchema = z.object({
  kid_profile_id: z.string().uuid().optional().nullable(),
  milestone: z.enum([
    'until_18', 'next_birthday', 'starts_school',
    'gets_license', 'summer', 'custom',
  ]),
  unit: z.enum(['weekends', 'bedtimes']),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function recordWeekendsRun(
  input: z.input<typeof RecordWeekendsRunSchema>,
): Promise<MomentActionResult> {
  const parsed = RecordWeekendsRunSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid input' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  const anonId = user ? null : await getOrCreateAnonymousId()
  const admin = createAdminClient()

  const { error } = await admin.from('tool_intent_events').insert({
    tool: 'weekends',
    user_id: user?.id ?? null,
    anonymous_id: anonId,
    kid_profile_id: parsed.data.kid_profile_id ?? null,
    payload: {
      milestone: parsed.data.milestone,
      unit: parsed.data.unit,
      birthdate: parsed.data.birthdate,
    },
  })

  // Intent capture failure must never break the user-facing flow.
  if (error) {
    console.error('recordWeekendsRun failed:', error.message)
    return { ok: false, error: 'Tracking failed' }
  }

  return { ok: true }
}
