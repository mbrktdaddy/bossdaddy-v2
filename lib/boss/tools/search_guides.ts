import { CATEGORY_SLUGS } from '@/lib/categories'
import type { BossTool, Citation } from '../types'

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
        category: { type: 'string', enum: [...CATEGORY_SLUGS], description: 'Optional category filter.' },
        limit: { type: 'integer', maximum: GUIDE_LIMIT, description: 'Max results (<= 6).' },
      },
      required: ['query'],
    },
  },
  async handler(input, ctx) {
    const query = String(input.query ?? '').trim()
    const limit = Math.min(Number(input.limit) || GUIDE_LIMIT, GUIDE_LIMIT)
    if (!query) return { content: JSON.stringify({ guides: [], note: 'No query provided.' }) }

    let q = ctx.supabase
      .from('guides')
      .select('slug, title, excerpt')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .textSearch('search_vector', query, { type: 'websearch' })
      .limit(limit)

    if (typeof input.category === 'string' && input.category) q = q.eq('category', input.category)

    const { data, error } = await q
    if (error) throw error
    const rows = data ?? []

    const citations: Citation[] = rows.map((r) => ({
      kind: 'guide',
      slug: r.slug,
      title: r.title,
      url: `/guides/${r.slug}`,
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
