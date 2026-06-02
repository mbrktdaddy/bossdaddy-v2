import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PhraseKind = 'one_liner' | 'slang' | 'opener' | 'joke' | 'phrase'
export type PhraseStatus = 'proposed' | 'approved' | 'archived'

export interface VoicePhrase {
  id: string
  user_id: string
  text: string
  kind: PhraseKind
  tone: string | null
  contexts_avoid: string[]
  status: PhraseStatus
  times_seen: number
  source_review_id: string | null
  created_at: string
  updated_at: string
}

export const PHRASE_KINDS: PhraseKind[] = ['one_liner', 'slang', 'opener', 'joke', 'phrase']

export const PHRASE_KIND_LABEL: Record<PhraseKind, string> = {
  one_liner: 'One-liner',
  slang:     'Slang / vocabulary',
  opener:    'Opener',
  joke:      'Joke',
  phrase:    'Recurring phrase',
}

// Edge-off topics a phrase can be flagged to avoid. Mirrors the BOSS_DADDY_SYSTEM
// §EDGE-OFF guardrail — learned jokes/slang must auto-suppress on these.
export const AVOID_CONTEXTS = ['grief', 'safety', 'struggle', 'faith', 'money'] as const
export type AvoidContext = (typeof AVOID_CONTEXTS)[number]

export const AVOID_CONTEXT_LABEL: Record<AvoidContext, string> = {
  grief:     'Grief / loss',
  safety:    'Safety-critical',
  struggle:  'Hardship / vulnerability',
  faith:     'Faith',
  money:     'Money / debt',
}

// ─── Data access ────────────────────────────────────────────────────────────

/**
 * Approved phrases for a user, newest first. Only `approved` rows are ever
 * injected into the prompt — `proposed` is a review queue, `archived` is dead.
 */
export async function getApprovedPhrases(
  supabase: SupabaseClient,
  userId: string,
): Promise<VoicePhrase[]> {
  const { data, error } = await supabase
    .from('voice_phrases')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('getApprovedPhrases failed:', error)
    return []
  }
  return (data as VoicePhrase[] | null) ?? []
}

/** All phrases for a user (the lexicon manager view), newest first. */
export async function getAllPhrases(
  supabase: SupabaseClient,
  userId: string,
): Promise<VoicePhrase[]> {
  const { data, error } = await supabase
    .from('voice_phrases')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('getAllPhrases failed:', error)
    return []
  }
  return (data as VoicePhrase[] | null) ?? []
}

// ─── Prompt formatting ──────────────────────────────────────────────────────

// Hard cap on how many phrases ride along in any single prompt. The whole point
// of the palette is "use 2-3 where natural" — injecting 150 options both drowns
// that instruction and adds real per-call token cost. We take the most-RECENT N
// (deterministic, so the cached block stays stable) rather than a random sample,
// because random sampling would change the block every call and defeat caching.
// True rotation (surfacing older gems on a stable weekly seed) is a later tuning
// pass; bounding the size is the thing that matters now.
const MAX_VOICE_CARD_PHRASES = 40

const KIND_ORDER: PhraseKind[] = ['opener', 'one_liner', 'phrase', 'slang', 'joke']

const PROMPT_GROUP_HEADING: Record<PhraseKind, string> = {
  opener:    'Openers he reaches for',
  one_liner: 'One-liners',
  phrase:    'Recurring phrases',
  slang:     'Slang / vocabulary',
  joke:      'Jokes / bits',
}

/**
 * Build the "Voice Card" — a compact palette of the author's signature phrases
 * for Claude to draw from. Returns null when there's nothing approved yet.
 *
 * This is injected as a PALETTE, not a script: the instruction caps usage at a
 * few natural touches and hard-suppresses flagged phrases on sensitive topics,
 * so drafts pick up the author's flavor without sounding like a phrase salad.
 */
export function formatVoiceLexiconForPrompt(phrases: VoicePhrase[]): string | null {
  // Keep input order (getApprovedPhrases sorts created_at desc) so the cap takes
  // the most-recent phrases, then bound the set before grouping/formatting.
  const approved = phrases
    .filter((p) => p.status === 'approved' && p.text?.trim())
    .slice(0, MAX_VOICE_CARD_PHRASES)
  if (approved.length === 0) return null

  const lines: string[] = [
    "The author's signature voice — his own recurring phrases, slang, openers, and bits.",
    'Use this as a PALETTE, not a checklist: weave in AT MOST 2–3 of these where they land naturally, and only where the rhythm calls for it. Never force one, never stack them, never use the whole list. A draft that name-drops every phrase reads worse than one with none.',
    'Hard rule: drop ALL of these on sensitive moments — grief, loss, safety-critical guidance, financial hardship, or any vulnerable topic. When in doubt, leave them out. Also honor each phrase\'s "avoid on" tag below.',
    '',
  ]

  for (const kind of KIND_ORDER) {
    const group = approved.filter((p) => p.kind === kind)
    if (group.length === 0) continue
    lines.push(`${PROMPT_GROUP_HEADING[kind]}:`)
    for (const p of group) {
      const avoid = (p.contexts_avoid ?? []).filter(Boolean)
      const tone = p.tone?.trim()
      const meta = [
        tone ? `tone: ${tone}` : null,
        avoid.length ? `avoid on: ${avoid.join(', ')}` : null,
      ].filter(Boolean).join('; ')
      lines.push(`- "${p.text.trim()}"${meta ? ` (${meta})` : ''}`)
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}
