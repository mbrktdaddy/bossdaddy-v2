'use server'

// Kid profile CRUD + anonymous claim flow.
//
// Authenticated users: writes go through the SSR client (RLS-bound).
// Anonymous users: writes go through the admin client, ownership verified
// against the bd_anon_id cookie. On signup, claimAnonymousData() migrates
// anonymous rows into the authenticated user_id.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateAnonymousId, getAnonymousId } from './cookies'

const KidInputSchema = z.object({
  name: z.string().trim().min(1).max(80).optional().nullable(),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Birthdate required (YYYY-MM-DD)'),
  photo_url: z.string().url().optional().nullable(),
})

const UpdateKidInputSchema = KidInputSchema.partial({ birthdate: true }).extend({
  id: z.string().uuid(),
})

export type KidActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export type Kid = {
  id: string
  name: string | null
  birthdate: string
  photo_url: string | null
  money_balance: number
  money_monthly: number
  money_target: number
  money_return_rate: number
  created_at: string
  updated_at: string
}

const KID_COLUMNS =
  'id, name, birthdate, photo_url, money_balance, money_monthly, money_target, money_return_rate, created_at, updated_at'

// Tier-based kid count limits. Photo upload is a separate gate — anonymous
// can never upload (no stable identity to scope storage by), authenticated
// users at any tier can upload. See `/api/kids/[id]/photo`.
const KID_LIMITS: Record<string, number> = {
  admin:  Number.MAX_SAFE_INTEGER,
  author: 10,
  member: 5,
}
const ANONYMOUS_KID_LIMIT = 1

async function fetchRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return (data?.role as string | undefined) ?? 'member'
}

export async function getKidLimitFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | null,
): Promise<number> {
  if (!userId) return ANONYMOUS_KID_LIMIT
  const role = await fetchRole(supabase, userId)
  return KID_LIMITS[role] ?? KID_LIMITS.member
}

export async function getKids(): Promise<Kid[]> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (user) {
    const { data } = await supabase.from('kid_profiles')
      .select(KID_COLUMNS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    return (data ?? []) as Kid[]
  }

  const anonId = await getAnonymousId()
  if (!anonId) return []

  const admin = createAdminClient()
  const { data } = await admin.from('kid_profiles')
    .select(KID_COLUMNS)
    .eq('anonymous_id', anonId)
    .order('created_at', { ascending: true })
  return (data ?? []) as Kid[]
}

export async function addKid(
  input: z.input<typeof KidInputSchema>,
): Promise<KidActionResult<{ id: string }>> {
  const parsed = KidInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const payload = {
    name: parsed.data.name ?? null,
    birthdate: parsed.data.birthdate,
    photo_url: parsed.data.photo_url ?? null,
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (user) {
    // Enforce tier limit before insert. Members: 5. Authors: 10. Admins: ∞.
    const limit = await getKidLimitFor(supabase, user.id)
    const { count } = await supabase.from('kid_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if ((count ?? 0) >= limit) {
      return {
        ok: false,
        error: `You've reached the ${limit}-kid limit for your account. Remove a kid to add another.`,
      }
    }

    const { data, error } = await supabase.from('kid_profiles')
      .insert({ ...payload, user_id: user.id })
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }

    revalidateKidSurfaces()
    return { ok: true, data: { id: data.id as string } }
  }

  // Anonymous path — 1 kid max, no photo (the cookie is the only auth).
  const anonId = await getOrCreateAnonymousId()
  const admin = createAdminClient()
  const { count } = await admin.from('kid_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('anonymous_id', anonId)
  if ((count ?? 0) >= ANONYMOUS_KID_LIMIT) {
    return {
      ok: false,
      error: 'Sign up to track more than one kid. Your existing kid will carry over.',
    }
  }

  const { data, error } = await admin.from('kid_profiles')
    .insert({ ...payload, anonymous_id: anonId, photo_url: null })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  revalidatePath('/tools')
  revalidatePath('/tools/weekends-until')
  return { ok: true, data: { id: data.id as string } }
}

export async function updateKid(
  input: z.input<typeof UpdateKidInputSchema>,
): Promise<KidActionResult> {
  const parsed = UpdateKidInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { id, name, birthdate, photo_url } = parsed.data
  const updates: {
    name?: string | null
    birthdate?: string
    photo_url?: string | null
  } = {}
  if (name      !== undefined) updates.name      = name
  if (birthdate !== undefined) updates.birthdate = birthdate
  if (photo_url !== undefined) updates.photo_url = photo_url

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: 'No fields to update' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (user) {
    const { error } = await supabase.from('kid_profiles')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }

    revalidateKidSurfaces()
    return { ok: true }
  }

  const anonId = await getAnonymousId()
  if (!anonId) return { ok: false, error: 'No anonymous session' }

  const admin = createAdminClient()
  const { error } = await admin.from('kid_profiles')
    .update(updates)
    .eq('id', id)
    .eq('anonymous_id', anonId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/tools')
  revalidatePath('/tools/weekends-until')
  return { ok: true }
}

export async function deleteKid(id: string): Promise<KidActionResult> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Invalid id' }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (user) {
    const { error } = await supabase.from('kid_profiles')
      .delete()
      .eq('id', parsed.data)
      .eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }

    // Storage cleanup — remove any uploaded kid photos so we don't leak
    // orphan files. Best-effort: a storage failure here doesn't roll back
    // the DB delete (the kid is already gone).
    const admin = createAdminClient()
    const folder = `kids/${parsed.data}`
    const { data: files } = await admin.storage.from('avatars').list(folder)
    if (files && files.length > 0) {
      await admin.storage.from('avatars')
        .remove(files.map((f) => `${folder}/${f.name}`))
    }

    revalidateKidSurfaces()
    return { ok: true }
  }

  const anonId = await getAnonymousId()
  if (!anonId) return { ok: false, error: 'No anonymous session' }

  const admin = createAdminClient()
  const { error } = await admin.from('kid_profiles')
    .delete()
    .eq('id', parsed.data)
    .eq('anonymous_id', anonId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/tools')
  revalidatePath('/tools/weekends-until')
  return { ok: true }
}

const KidMoneyStateSchema = z.object({
  id:             z.string().uuid(),
  balance:        z.number().min(0).max(1e12),
  monthly:        z.number().min(0).max(1e10),
  target:         z.number().min(0).max(1e12),
  returnRate:     z.number().min(0).max(0.30),
})

// Persist Dad Math inputs for a kid. Authenticated only — anonymous users
// keep their state in the URL since they don't have a stable identity to
// attach money state to. Matches the DB constraints in migration 077.
export async function updateKidMoneyState(
  input: z.input<typeof KidMoneyStateSchema>,
): Promise<KidActionResult> {
  const parsed = KidMoneyStateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Sign in to save Dad Math inputs' }

  const { error } = await supabase.from('kid_profiles')
    .update({
      money_balance:     parsed.data.balance,
      money_monthly:     parsed.data.monthly,
      money_target:      parsed.data.target,
      money_return_rate: parsed.data.returnRate,
    })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidateKidSurfaces()
  return { ok: true }
}

// Every surface that reads kid_profiles for an authenticated user. Used by
// addKid / updateKid / deleteKid / updateKidMoneyState so the surface list
// stays consistent — add a new path here when MyKidsSection or the kid hub
// gains a new home.
function revalidateKidSurfaces() {
  revalidatePath('/dashboard')
  revalidatePath('/account/settings')
  revalidatePath('/tools')
  revalidatePath('/tools/kids/[id]', 'page')
  revalidatePath('/tools/weekends-until')
}

// Called after signup. Migrates anonymous-cookie rows into the new user.
// Safe to call multiple times — re-running just no-ops once anonymous_id
// has been cleared from the rows.
export async function claimAnonymousData(): Promise<KidActionResult<{ kidsMigrated: number }>> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }

  const anonId = await getAnonymousId()
  if (!anonId) return { ok: true, data: { kidsMigrated: 0 } }

  const admin = createAdminClient()

  const { data: migratedKids, error: kidsError } = await admin.from('kid_profiles')
    .update({ user_id: user.id, anonymous_id: null })
    .eq('anonymous_id', anonId)
    .select('id')

  if (kidsError) return { ok: false, error: kidsError.message }

  // Best-effort migration of related anonymous rows. Failures here don't
  // block the kid migration; intent events and email subs are non-critical.
  await admin.from('tool_intent_events')
    .update({ user_id: user.id, anonymous_id: null })
    .eq('anonymous_id', anonId)

  await admin.from('tool_email_subscriptions')
    .update({ user_id: user.id, anonymous_id: null })
    .eq('anonymous_id', anonId)

  revalidatePath('/dashboard')
  revalidatePath('/tools/weekends-until')

  return { ok: true, data: { kidsMigrated: (migratedKids ?? []).length } }
}
