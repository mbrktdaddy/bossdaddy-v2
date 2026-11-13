import type { SupabaseClient } from '@supabase/supabase-js'
import { BriefInput, briefDataBlocks, briefFacts, normalizeBrief } from './briefs'
import type { ReferenceNote } from '../references'
import type { Brief, ContentType } from './types'

// What a refine is allowed to know about a piece beyond its own text: the
// author's notes and the fetched reference facts the piece was drafted from.
//
// A refine used to see only the document, so "add the price I paid" or "cite
// the weight" left it two bad options — invent the detail, or drop it — and a
// sourced fact could be rewritten as the author's own test. The brief lives on
// the piece's run (`content_runs.content_id`, set by attachRun at first save);
// the refine routes already receive `contentId`, so they load it here.
//
// Pieces with no run (written by hand, or drafted before the staged pipeline)
// get no grounding block and refine exactly as before.

/**
 * The brief behind a saved piece, or null when there is no run, no access
 * (RLS: a run is readable only by its author) or the stored shape has drifted.
 */
export async function loadBriefForContent(
  supabase: SupabaseClient,
  contentType: ContentType,
  contentId: string | undefined | null,
): Promise<Brief | null> {
  if (!contentId) return null
  const { data, error } = await supabase
    .from('content_runs')
    .select('brief')
    .eq('content_id', contentId)
    .eq('content_type', contentType)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const parsed = BriefInput.safeParse(data.brief)
  return parsed.success ? normalizeBrief(parsed.data) : null
}

/**
 * The prompt block that grounds a refine: the author's notes (the only firsthand
 * material that may be added) plus the fenced reference and spec blocks, with
 * the attribution rule. '' when there is no brief.
 */
export function refineGrounding(brief: Brief | null): string {
  if (!brief) return ''
  const facts = briefFacts(brief)
  const data = briefDataBlocks(brief)
  const lines: string[] = [
    facts.length
      ? 'AUTHOR NOTES — the firsthand material the author supplied for this piece. When the instruction asks for a detail, bring it in from these lines. Any other usage claim, duration, test result or family moment that is not already in the current text is invented: never add one.'
      : 'AUTHOR NOTES — none were supplied. Add no usage claim, test result, duration or family moment that is not already in the current text.',
  ]
  if (facts.length) lines.push(facts.map((f) => `- ${f}`).join('\n'))
  if (data) {
    lines.push(
      data,
      'The reference notes and specs above are attributed knowledge, not experience. When the instruction asks for a spec or a sourced fact, state it as what the source says (name the source in words, never a URL); never present it as something the author did, tested or saw.',
    )
  }
  return lines.join('\n')
}

/** What the workspace shows read-only: the author's notes and the sources that carried facts. */
export interface GroundingSummary {
  facts: string[]
  references: ReferenceNote[]
}

/** null when there is no brief, or it carried neither notes nor usable references. */
export function groundingSummary(brief: Brief | null): GroundingSummary | null {
  if (!brief) return null
  const facts = briefFacts(brief)
  const references = (brief.referenceNotes ?? []).filter((n) => n.status === 'ok' && n.facts.length > 0)
  return facts.length || references.length ? { facts, references } : null
}
