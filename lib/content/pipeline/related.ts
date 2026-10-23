import type { SupabaseClient } from '@supabase/supabase-js'
import type { Brief, RelatedPiece } from './types'
import { briefSubject } from './briefs'

// "Have we covered this?" — the cheap version: approved pieces whose title
// shares the subject's distinctive words. Enough to surface a duplicate review
// of the same product or a guide on the same topic, and to hand the outline
// its cross-link candidates. The vector search (mig 125) can replace this
// when the Boss's retrieval tools come back; the call shape stays the same.

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'of', 'to', 'in', 'on', 'with', 'how', 'what', 'why', 'your', 'you', 'is', 'it', 'my', 'our', 'best', 'guide', 'review', 'dad', 'dads', 'kids', 'kid'])

export function subjectTerms(subject: string): string[] {
  return [...new Set(
    subject.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP.has(w)),
  )].slice(0, 6)
}

export async function findRelated(supabase: SupabaseClient, brief: Brief, limit = 6): Promise<RelatedPiece[]> {
  const terms = subjectTerms(briefSubject(brief))
  if (!terms.length) return []
  // PostgREST `or` with ilike per term; `%` wildcards need the term escaped.
  const pattern = (t: string) => `title.ilike.%${t.replace(/[%_,()]/g, '')}%`
  const or = terms.map(pattern).join(',')

  const [reviews, guides] = await Promise.all([
    supabase.from('reviews').select('slug, title').eq('status', 'approved').or(or).limit(limit),
    supabase.from('guides').select('slug, title').eq('status', 'approved').or(or).limit(limit),
  ])

  const score = (title: string) => terms.filter((t) => title.toLowerCase().includes(t)).length
  const rows: (RelatedPiece & { score: number })[] = [
    ...((reviews.data ?? []) as { slug: string; title: string }[]).map((r) => ({ type: 'review' as const, slug: r.slug, title: r.title, score: score(r.title) })),
    ...((guides.data ?? []) as { slug: string; title: string }[]).map((g) => ({ type: 'guide' as const, slug: g.slug, title: g.title, score: score(g.title) })),
  ]
  return rows
    .filter((r) => r.score >= Math.min(2, terms.length))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ type, slug, title }) => ({ type, slug, title }))
}
