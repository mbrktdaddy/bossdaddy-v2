import { orTsQuery } from '../searchQuery'
import type { Block, BossTool } from '../types'

const GUIDE_LIMIT = 6

// B — Fix & Build. Grounded retrieval over approved guides/how-tos. When a guide
// exists, cite + link it; when none matches, the model answers from general
// knowledge in voice WITHOUT pretending to cite a guide.
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

    // Strict full-text first; broaden to an OR-of-terms fallback when strict finds
    // nothing, so natural phrasing ("how do I PREVENT razor rash") still matches a
    // guide whose text lacks one word. No category filter (see search_gear).
    const base = () =>
      ctx.supabase
        .from('guides')
        .select('slug, title, excerpt, category, reading_time_minutes')
        .eq('status', 'approved')
        .eq('is_visible', true)
        .limit(limit)

    const strict = await base().textSearch('search_vector', query, { type: 'websearch' })
    if (strict.error) throw strict.error
    let rows = strict.data ?? []
    if (!rows.length) {
      const orQuery = orTsQuery(query)
      if (orQuery) {
        const relaxed = await base().textSearch('search_vector', orQuery)
        if (relaxed.error) throw relaxed.error
        rows = relaxed.data ?? []
      }
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
