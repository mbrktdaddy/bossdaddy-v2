import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createStructured } from '@/lib/claude/structured'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 30

// The model returns the meta by calling this tool — its input_schema is the
// shape, so the SDK validates it instead of us regex-parsing JSON.
const SEO_TOOL: Anthropic.Tool = {
  name: 'submit_seo_meta',
  description: 'Return the SEO meta title and description.',
  input_schema: {
    type: 'object',
    properties: {
      metaTitle:       { type: 'string' },
      metaDescription: { type: 'string' },
    },
    required: ['metaTitle', 'metaDescription'],
  },
}

const Input = z.object({
  title:        z.string().min(1).max(120),
  product_name: z.string().max(120).optional(),
  category:     z.string().max(80).optional(),
  excerpt:      z.string().max(500).optional(),
  content:      z.string().max(3000).optional(),
  content_type: z.enum(['review', 'guide', 'collection']).default('review'),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { success } = await checkRateLimit(`seo-meta:${user.id}`, 'claude-aux')
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded — try again shortly.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = Input.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { title, product_name, category, excerpt, content, content_type } = parsed.data

  const plainContent = content
    ? content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500)
    : ''

  const prompt = `Write SEO meta title and description for this Boss Daddy ${content_type}.

Title: ${title}${product_name ? `\nProduct: ${product_name}` : ''}${category ? `\nCategory: ${category}` : ''}${excerpt ? `\nExcerpt: ${excerpt}` : ''}${plainContent ? `\nContent preview: ${plainContent}` : ''}

Rules:
- Meta title: 50–60 chars. Include product name or main topic. Action-oriented. No clickbait.
- Meta description: 140–160 chars. Summarize the value. Include 1-2 natural keywords. End with a subtle call to action.
- Write in the Boss Daddy voice — confident, direct, dad-tested credibility.

Return your result by calling the submit_seo_meta tool.`

  try {
    // No voice system block — meta tags are short SEO snippets, not brand prose.
    const result = await createStructured({
      system: undefined,
      messages: [{ role: 'user', content: prompt }],
      tool: SEO_TOOL,
      maxTokens: 400,
    })

    if (!result.data) return NextResponse.json({ error: 'Unexpected model response' }, { status: 502 })

    return NextResponse.json({
      metaTitle:       result.data.metaTitle,
      metaDescription: result.data.metaDescription,
    })
  } catch (err) {
    console.error('seo-meta generation error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 502 })
  }
}
