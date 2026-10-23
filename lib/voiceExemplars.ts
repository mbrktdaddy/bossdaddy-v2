import type { SupabaseClient } from '@supabase/supabase-js'

// Voice exemplars (mig 165): up to MAX_EXEMPLARS approved pieces the author
// picked as examples of how he actually writes. Their excerpts ride in the
// cached system block after the phrase palette. Rules describe a voice;
// examples demonstrate it — Anthropic's own guidance puts examples first.

export const MAX_EXEMPLARS = 3
/** ≈ 600 words of structured text per exemplar. */
export const MAX_EXEMPLAR_CHARS = 4000

export interface VoiceExemplar {
  id: string
  user_id: string
  content_type: 'review' | 'guide'
  content_id: string
  title: string
  excerpt: string
  position: number
  created_at: string
}

export async function getVoiceExemplars(supabase: SupabaseClient, userId: string): Promise<VoiceExemplar[]> {
  const { data, error } = await supabase
    .from('voice_exemplars')
    .select('*')
    .eq('user_id', userId)
    .order('position')
    .limit(MAX_EXEMPLARS)
  if (error) {
    console.error('getVoiceExemplars failed:', error.message)
    return []
  }
  return (data as VoiceExemplar[] | null) ?? []
}

export interface ExemplarCandidate {
  type: 'review' | 'guide'
  id: string
  title: string
  slug: string
}

/** The author's approved pieces — what the picker offers. */
export async function listExemplarCandidates(supabase: SupabaseClient, userId: string): Promise<ExemplarCandidate[]> {
  const [reviews, guides] = await Promise.all([
    supabase.from('reviews').select('id, title, slug').eq('author_id', userId).eq('status', 'approved').order('published_at', { ascending: false }).limit(60),
    supabase.from('guides').select('id, title, slug').eq('author_id', userId).eq('status', 'approved').order('published_at', { ascending: false }).limit(60),
  ])
  return [
    ...((reviews.data ?? []) as { id: string; title: string; slug: string }[]).map((r) => ({ type: 'review' as const, ...r })),
    ...((guides.data ?? []) as { id: string; title: string; slug: string }[]).map((g) => ({ type: 'guide' as const, ...g })),
  ]
}

/**
 * The exemplar block for the system prompt, or null when none are picked.
 * Framed as register and rhythm to match — never phrases to reuse — so the
 * model doesn't quote the exemplars back.
 */
export function formatVoiceExemplarsForPrompt(exemplars: VoiceExemplar[]): string | null {
  const picks = exemplars.filter((e) => e.excerpt?.trim()).slice(0, MAX_EXEMPLARS)
  if (!picks.length) return null
  const lines = [
    "VOICE EXEMPLARS — published pieces in the author's own voice. Match their register, rhythm, sentence variety and the way they move from a concrete moment to the point. Do NOT reuse their sentences, openers or jokes; they show HOW he writes, not WHAT to say.",
    '',
  ]
  picks.forEach((e, i) => {
    lines.push(`--- Exemplar ${i + 1}: "${e.title}" (${e.content_type}) ---`)
    lines.push(e.excerpt.trim().slice(0, MAX_EXEMPLAR_CHARS))
    lines.push('')
  })
  return lines.join('\n').trimEnd()
}
