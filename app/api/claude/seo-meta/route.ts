import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 30

const Input = z.object({
  title:        z.string().min(1).max(120),
  product_name: z.string().max(120).optional(),
  category:     z.string().max(80).optional(),
  excerpt:      z.string().max(500).optional(),
  content:      z.string().max(3000).optional(),
  content_type: z.enum(['review', 'guide']).default('review'),
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

Return JSON only: { "metaTitle": "string", "metaDescription": "string" }`

  try {
    const text = await getClaudeClient().messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }).then((m) => m.content.find((b) => b.type === 'text')?.text ?? '')

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Unexpected model response' }, { status: 502 })

    const result = JSON.parse(match[0])
    return NextResponse.json(result)
  } catch (err) {
    console.error('seo-meta generation error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 502 })
  }
}
