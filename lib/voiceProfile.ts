import type { SupabaseClient } from '@supabase/supabase-js'
import type { SystemModelMessage } from 'ai'
import { BOSS_DADDY_SYSTEM } from '@/lib/claude/client'
import { getApprovedPhrases, formatVoiceLexiconForPrompt } from '@/lib/voiceLexicon'

export interface VoiceFact {
  id: string
  label: string
  value: string
}

export type Gender = 'male' | 'female' | 'other'

export interface FamilyMember {
  id: string
  relationship: string
  name: string | null
  dob: string | null
  gender: Gender | null
}

export interface VoiceProfile {
  id: string
  user_id: string
  family_members: FamilyMember[]
  occupation: string | null
  faith_values: string | null
  region: string | null
  facts: VoiceFact[]
  updated_at: string
}

export type VoiceProfileInput = Omit<VoiceProfile, 'id' | 'user_id' | 'updated_at'>

export function emptyVoiceProfile(): VoiceProfileInput {
  return {
    family_members: [],
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

function personAgeLabel(dob: string | null, today: Date): string | null {
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

  for (const m of profile.family_members ?? []) {
    const relationship = m.relationship?.trim()
    if (!relationship) continue
    const name = m.name?.trim()
    const namePart = name ? ` (${name})` : ''
    const ageLabel = personAgeLabel(m.dob, now)
    if (ageLabel) {
      lines.push(`- ${relationship}${namePart}: ${ageLabel}`)
    } else {
      lines.push(`- ${relationship}${namePart}`)
    }
  }

  if (profile.occupation?.trim()) lines.push(`- Background / experience: ${profile.occupation.trim()}`)
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
 * Block order is chosen for prompt-cache efficiency (cache hits the longest
 * matching prefix), so blocks run most-stable → most-volatile:
 *   1. BOSS_DADDY_SYSTEM   — cached. Shared across ALL users + all calls.
 *   2. Voice Card          — cached. Per-user but stable (changes ~weekly as
 *                            the lexicon grows). Only approved phrases.
 *   3. Voice profile facts — UNCACHED. Small, and edited more freely (family
 *                            ages recompute every call), so caching it would
 *                            invalidate more often than it helps.
 *
 * Each section is omitted entirely when empty — no point telling Claude the
 * author has no profile or no signature phrases.
 */
// The raw system parts in cache-optimal order (see the doc comment above), with
// a flag for whether each should carry a cache breakpoint. Both public builders
// project from this so the block order + cache decisions live in ONE place.
async function buildVoiceSystemParts(
  supabase: SupabaseClient,
  userId: string,
): Promise<Array<{ text: string; cache: boolean }>> {
  const parts: Array<{ text: string; cache: boolean }> = [
    { text: BOSS_DADDY_SYSTEM, cache: true },
  ]

  const [profile, phrases] = await Promise.all([
    getVoiceProfile(supabase, userId),
    getApprovedPhrases(supabase, userId),
  ])

  const voiceCard = formatVoiceLexiconForPrompt(phrases)
  if (voiceCard) parts.push({ text: voiceCard, cache: true })

  const voiceBlock = formatVoiceProfileForPrompt(profile)
  if (voiceBlock) parts.push({ text: voiceBlock, cache: false })

  return parts
}

/** Anthropic-SDK `system` array (used by not-yet-migrated `lib/claude` callers). */
export async function buildBossDaddySystemBlocks(
  supabase: SupabaseClient,
  userId: string,
): Promise<SystemBlock[]> {
  const parts = await buildVoiceSystemParts(supabase, userId)
  return parts.map((p) =>
    p.cache
      ? { type: 'text', text: p.text, cache_control: { type: 'ephemeral' } }
      : { type: 'text', text: p.text },
  )
}

/**
 * AI-SDK `system` messages for the gateway wrappers (`lib/ai/client.ts`). Same
 * blocks + same cache breakpoints as buildBossDaddySystemBlocks, expressed as
 * SystemModelMessages — the Anthropic `cacheControl` is forwarded through the
 * gateway; providers without explicit caching ignore it.
 */
export async function buildBossDaddySystemMessages(
  supabase: SupabaseClient,
  userId: string,
): Promise<SystemModelMessage[]> {
  const parts = await buildVoiceSystemParts(supabase, userId)
  return parts.map((p) =>
    p.cache
      ? {
          role: 'system',
          content: p.text,
          providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
        }
      : { role: 'system', content: p.text },
  )
}
