import { NextResponse, type NextRequest } from 'next/server'
import { jsonSchema } from 'ai'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { aiGenerateObject } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 30

// The model output is validated against this schema (reused verbatim from the
// old tool's input_schema — the AI SDK enforces it instead of regex-parsing).
const SEO_SCHEMA = jsonSchema<{ metaTitle: string; metaDescription: string }>({
  type: 'object',
  properties: {
    metaTitle: { type: 'string' },
    metaDescription: { type: 'string' },
  },
  required: ['metaTitle', 'metaDescription'],
})

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
- Write in the Boss Daddy voice — confident, direct, dad-tested credibility.`

  try {
    // No voice system block — meta tags are short SEO snippets, not brand prose.
    const meta = await aiGenerateObject({
      bucket: 'utility',
      tag: 'seo-meta',
      schema: SEO_SCHEMA,
      prompt,
      maxOutputTokens: 400,
    })
    return NextResponse.json({ metaTitle: meta.metaTitle, metaDescription: meta.metaDescription })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('seo-meta generation error:', c.kind, '-', c.detail)
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}
