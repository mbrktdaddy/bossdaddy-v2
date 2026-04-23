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

  const { title, excerpt, category, current_id } = parsed.data
  const admin = createAdminClient()

  // Fetch published content — same category first, then broader
  const [{ data: sameCategoryArticles }, { data: sameCategoryReviews }] = await Promise.all([
    admin
      .from('articles')
      .select('id, title, slug, excerpt')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .eq('category', category)
      .neq('id', current_id ?? '00000000-0000-0000-0000-000000000000')
      .limit(15),
    admin
      .from('reviews')
      .select('id, title, slug, excerpt, product_name')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .eq('category', category)
      .neq('id', current_id ?? '00000000-0000-0000-0000-000000000000')
      .limit(15),
  ])

  const candidates = [
    ...(sameCategoryArticles ?? []).map((a) => ({
      type: 'article' as const, id: a.id, title: a.title, slug: a.slug, excerpt: a.excerpt ?? '', url: `/articles/${a.slug}`,
    })),
    ...(sameCategoryReviews ?? []).map((r) => ({
      type: 'review' as const, id: r.id, title: r.title, slug: r.slug, excerpt: r.excerpt ?? '', url: `/reviews/${r.slug}`,
    })),
  ]

  if (candidates.length === 0) {
    return NextResponse.json({ suggestions: [] })
  }

  // Ask Claude to pick the most relevant 3-5
  const prompt = `You're editing a piece titled "${title}"${excerpt ? ` with excerpt "${excerpt}"` : ''} in category "${category}".

Below is a list of published content from the same category. Choose 3–5 items that would be most relevant to link TO from the piece being edited — choose based on likely reader interest and topical relevance, not just keyword overlap. Prefer reviews when the piece is a guide and vice versa.

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
