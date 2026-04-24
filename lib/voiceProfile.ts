import type { SupabaseClient } from '@supabase/supabase-js'
import { BOSS_DADDY_SYSTEM } from '@/lib/claude/client'

export interface VoiceFact {
  id: string
  label: string
  value: string
}

export interface VoiceProfile {
  id: string
  user_id: string
  self_dob: string | null
  wife_dob: string | null
  daughter_dob: string | null
  occupation: string | null
  faith_values: string | null
  region: string | null
  facts: VoiceFact[]
  updated_at: string
}

export type VoiceProfileInput = Omit<VoiceProfile, 'id' | 'user_id' | 'updated_at'>

export function emptyVoiceProfile(): VoiceProfileInput {
  return {
    self_dob: null,
    wife_dob: null,
    daughter_dob: null,
    occupation: null,
    faith_values: null,
    region: null,
    facts: [],
  }
}

function ageFromDob(dob: string | null, today: Date): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  let years = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) years -= 1
  return years < 0 ? null : years
}

function daughterAgeLabel(dob: string | null, today: Date): string | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const diffMs = today.getTime() - d.getTime()
  const months = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44)))
  if (months < 24) return `${months} months old`
  const y = ageFromDob(dob, today)
  return y === null ? null : `${y} years old`
}

export async function getVoiceProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<VoiceProfile | null> {
  const { data, error } = await supabase
    .from('voice_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('getVoiceProfile failed:', error)
    return null
  }
  return (data as VoiceProfile | null) ?? null
}

/**
 * Build a system-prompt block from a user's voice profile. Returns null if
 * the profile has nothing useful — the caller should then omit the block
 * entirely (no point in telling Claude "the author has no profile").
 *
 * Ages are computed at call time so long-running content stays truthful
 * without the author manually editing dates each year.
 */
export function formatVoiceProfileForPrompt(
  profile: VoiceProfile | null,
  now: Date = new Date(),
): string | null {
  if (!profile) return null

  const lines: string[] = []
  const selfAge = ageFromDob(profile.self_dob, now)
  if (selfAge !== null) lines.push(`- Author age: ${selfAge}`)
  const wifeAge = ageFromDob(profile.wife_dob, now)
  if (wifeAge !== null) lines.push(`- Wife age: ${wifeAge}`)
  const daughterLabel = daughterAgeLabel(profile.daughter_dob, now)
  if (daughterLabel) lines.push(`- Daughter: ${daughterLabel}`)
  if (profile.occupation?.trim()) lines.push(`- Occupation: ${profile.occupation.trim()}`)
  if (profile.faith_values?.trim()) lines.push(`- Faith / values: ${profile.faith_values.trim()}`)
  if (profile.region?.trim()) lines.push(`- Region: ${profile.region.trim()}`)

  const extraFacts = (profile.facts ?? []).filter((f) => f.value?.trim())
  for (const f of extraFacts) {
    const label = f.label?.trim()
    lines.push(label ? `- ${label}: ${f.value.trim()}` : `- ${f.value.trim()}`)
  }

  if (lines.length === 0) return null

  const asOf = now.toISOString().slice(0, 10)
  return [
    `About the author — use these facts as ground truth; never invent personal details that contradict or extend them. Dates are as of ${asOf}.`,
    ...lines,
    `If a claim would require a personal detail not listed above, write around it or omit it. Do not fabricate family members, hobbies, jobs, locations, or testing scenarios that the author has not confirmed.`,
  ].join('\n')
}

type SystemBlock =
  | { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }

/**
 * Build the Claude `system` array for Boss Daddy content endpoints.
 *
 * Always includes the cached BOSS_DADDY_SYSTEM block. If the user has a
 * voice profile with anything in it, a second uncached block is appended
 * — uncached because it varies per user and is small enough that caching
 * it would just invalidate more often than it helps.
 */
export async function buildBossDaddySystemBlocks(
  supabase: SupabaseClient,
  userId: string,
): Promise<SystemBlock[]> {
  const blocks: SystemBlock[] = [
    { type: 'text', text: BOSS_DADDY_SYSTEM, cache_control: { type: 'ephemeral' } },
  ]
  const profile = await getVoiceProfile(supabase, userId)
  const voiceBlock = formatVoiceProfileForPrompt(profile)
  if (voiceBlock) blocks.push({ type: 'text', text: voiceBlock })
  return blocks
}

