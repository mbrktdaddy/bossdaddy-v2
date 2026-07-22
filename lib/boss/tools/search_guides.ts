import { embedQuery } from '@/lib/ai/embedding'
import type { Block, BossTool } from '../types'

const GUIDE_LIMIT = 6
// See search_gear — same cosine-similarity floor (0.35), chosen from the measured
// distribution so on-topic guides clear it while adjacent/off-topic ones fall out.
const MIN_SIMILARITY = 0.35

const COLS = 'slug, title, excerpt, category, reading_time_minutes'

type Row = {
  slug: string
  title: string
  excerpt: string | null
  category: string | null
  reading_time_minutes: number | null
}

// B — Fix & Build. Grounded retrieval over approved guides/how-tos via HYBRID
// search (migration 125): full-text precision + semantic recall, RRF-fused and
// similarity-floored. When a guide matches, cite + link it; when none does, the
// model answers from general knowledge in voice WITHOUT pretending to cite a guide.
export const searchGuides: BossTool = {
  definition: {
    name: 'search_guides',
    description:
      "Search Boss Daddy's own approved guides and how-to articles. Use for 'how do I', explainer, and project questions. When results come back, cite and link the guide. If none match, answer from general knowledge in voice and make clear you're not citing a Boss Daddy guide.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Topic keywords.' },
        limit: { type: 'integer', maximum: GUIDE_LIMIT, description: 'Max results (<= 6).' },
      },
      required: ['query'],
    },
  },
  async handler(input, ctx) {
    const query = String(input.query ?? '').trim()
    const limit = Math.min(Number(input.limit) || GUIDE_LIMIT, GUIDE_LIMIT)
    if (!query) return { content: JSON.stringify({ guides: [], note: 'No query provided.' }) }

    let rows: Row[] = []
    try {
      const embedding = await embedQuery(query)
      const { data, error } = await ctx.supabase
        .rpc('boss_hybrid_guides', {
          query_text: query,
          query_embedding: JSON.stringify(embedding),
          match_count: limit,
          min_similarity: MIN_SIMILARITY,
        })
        .select(COLS)
      if (error) throw error
      rows = (data ?? []) as Row[]
    } catch {
      // Degraded mode (embedding/gateway hiccup): STRICT full-text only — precise,
      // no OR-of-terms junk (semantic recall replaced that path).
      const { data } = await ctx.supabase
        .from('guides')
        .select(COLS)
        .eq('status', 'approved')
        .eq('is_visible', true)
        .limit(limit)
        .textSearch('search_vector', query, { type: 'websearch' })
      rows = (data ?? []) as Row[]
    }

    // Enrich the block so the client renders a first-class guide card (category +
    // one-line "why this helps" + read-time) without a second fetch.
    const citations: Block[] = rows.map((r) => ({
      kind: 'guide',
      slug: r.slug,
      title: r.title,
      url: `/guides/${r.slug}`,
      excerpt: r.excerpt,
      category: r.category,
      readingMinutes: r.reading_time_minutes,
    }))

    const guides = rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      guideUrl: `/guides/${r.slug}`,
    }))

    return {
      content: JSON.stringify({ guides, note: guides.length ? null : 'No Boss Daddy guide covers this yet.' }),
      citations,
    }
  },
}
