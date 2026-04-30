import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { z } from 'zod'

export const maxDuration = 30

const SuggestSchema = z.object({
  title:        z.string().min(3).max(200),
  excerpt:      z.string().max(400).optional().nullable(),
  category:     z.string().min(1).max(80),
  current_id:   z.string().uuid().optional().nullable(),
  content_type: z.enum(['guide', 'review']).optional(),
})

// POST /api/claude/suggest-links — find published articles/reviews relevant to the current content
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = SuggestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { title, excerpt, category, current_id, content_type } = parsed.data
  const admin = createAdminClient()
  const excludeId = current_id ?? '00000000-0000-0000-0000-000000000000'

  // Same-category pool first — that's where topical matches live
  const [{ data: sameCategoryArticles }, { data: sameCategoryReviews }] = await Promise.all([
    admin
      .from('guides')
      .select('id, title, slug, excerpt, category')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .eq('category', category)
      .neq('id', excludeId)
      .limit(15),
    admin
      .from('reviews')
      .select('id, title, slug, excerpt, product_name, category')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .eq('category', category)
      .neq('id', excludeId)
      .limit(15),
  ])

  const sameCategoryPool = [
    ...(sameCategoryArticles ?? []).map((a) => ({
      type: 'guide' as const, id: a.id, title: a.title, slug: a.slug, excerpt: a.excerpt ?? '', url: `/guides/${a.slug}`,
    })),
    ...(sameCategoryReviews ?? []).map((r) => ({
      type: 'review' as const, id: r.id, title: r.title, slug: r.slug, excerpt: r.excerpt ?? '', url: `/reviews/${r.slug}`,
    })),
  ]

  // If the same-category pool is thin, back-fill with cross-category so sparse
  // niches still get useful suggestions. Claude still decides final relevance.
  let candidates = sameCategoryPool
  if (sameCategoryPool.length < 5) {
    const [{ data: crossArticles }, { data: crossReviews }] = await Promise.all([
      admin
        .from('guides')
        .select('id, title, slug, excerpt')
        .eq('status', 'approved')
        .eq('is_visible', true)
        .neq('category', category)
        .neq('id', excludeId)
        .limit(10),
      admin
        .from('reviews')
        .select('id, title, slug, excerpt')
        .eq('status', 'approved')
        .eq('is_visible', true)
        .neq('category', category)
        .neq('id', excludeId)
        .limit(10),
    ])
    candidates = [
      ...sameCategoryPool,
      ...(crossArticles ?? []).map((a) => ({
        type: 'guide' as const, id: a.id, title: a.title, slug: a.slug, excerpt: a.excerpt ?? '', url: `/guides/${a.slug}`,
      })),
      ...(crossReviews ?? []).map((r) => ({
        type: 'review' as const, id: r.id, title: r.title, slug: r.slug, excerpt: r.excerpt ?? '', url: `/reviews/${r.slug}`,
      })),
    ]
  }

  if (candidates.length === 0) {
    return NextResponse.json({ suggestions: [] })
  }

  // Content-type steer: articles lean on reviews for product context and peer
  // articles for depth; reviews lean on articles for how-to context and peer
  // reviews for comparison.
  const steer = content_type === 'review'
    ? 'The piece being edited is a REVIEW. Favor linking to ARTICLES that provide how-to or buying-guide context, and to a small number of peer REVIEWS readers are likely to cross-shop.'
    : content_type === 'guide'
    ? 'The piece being edited is an ARTICLE (often a guide or roundup). Favor linking to REVIEWS for any product you name, and to a couple of peer ARTICLES that go deeper on related topics.'
    : 'Prefer cross-type links (reviews from a guide, guides from a review) over same-type.'

  const prompt = `You're editing a piece titled "${title}"${excerpt ? ` with excerpt "${excerpt}"` : ''} in category "${category}".

${steer}

Below is a pool of published content. Choose 3–5 items that would be most relevant to link TO from the piece being edited — choose based on likely reader interest and topical relevance, not keyword overlap. Natural anchor text is assumed.

Candidates:
${candidates.map((c, i) => `${i + 1}. [${c.type}] "${c.title}" — ${c.excerpt.slice(0, 120)}`).join('\n')}

Return ONLY a JSON array of the chosen indices (1-based), in order of relevance. Example: [3, 7, 1]. No commentary.`

  try {
    const message = await getClaudeClient().messages.create({
      model: MODEL,
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content.find((b) => b.type === 'text')?.text ?? ''
    const match = text.match(/\[[\d,\s]+\]/)
    if (!match) return NextResponse.json({ suggestions: candidates.slice(0, 5) })

    const indices = JSON.parse(match[0]) as number[]
    const suggestions = indices
      .map((i) => candidates[i - 1])
      .filter(Boolean)
      .slice(0, 5)

    return NextResponse.json({ suggestions: suggestions.length ? suggestions : candidates.slice(0, 5) })
  } catch (err) {
    console.error('Suggest-links Claude call failed:', err)
    // Fallback: return first 5 candidates without AI ranking
    return NextResponse.json({ suggestions: candidates.slice(0, 5) })
  }
}
