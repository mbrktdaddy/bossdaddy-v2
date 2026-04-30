import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClaudeClient, MODEL, MODERATOR_SYSTEM } from '@/lib/claude/client'
import { z } from 'zod'

const ModerateInput = z.union([
  z.object({ reviewId: z.string().uuid() }),
  z.object({ guideId: z.string().uuid() }),
  z.object({ articleId: z.string().uuid() }), // legacy alias
])

const ModerationResult = z.object({
  score: z.number().min(0).max(1),
  flags: z.array(z.string()),
  recommendation: z.enum(['approve', 'review', 'reject']),
})

// Internal endpoint — called server-side after review or article submission.
// Requires X-Internal-Secret header matching INTERNAL_API_SECRET env var.
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = ModerateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const isGuide = 'guideId' in parsed.data || 'articleId' in parsed.data
  const contentId = isGuide
    ? (('guideId' in parsed.data ? (parsed.data as { guideId: string }).guideId : (parsed.data as { articleId: string }).articleId))
    : (parsed.data as { reviewId: string }).reviewId
  const table = isGuide ? 'guides' : 'reviews'

  const { data: content, error } = await supabase
    .from(table)
    .select('id, title, content, has_affiliate_links, disclosure_acknowledged')
    .eq('id', contentId)
    .single()

  if (error || !content) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  }

  const prompt = `Review the following content submission:

Title: ${content.title}
Has affiliate links: ${content.has_affiliate_links ?? false}
Disclosure acknowledged: ${content.disclosure_acknowledged ?? false}

Content:
${content.content.slice(0, 4000)}

Return JSON: { "score": number (0-1), "flags": string[], "recommendation": "approve"|"review"|"reject" }`

  try {
    const claude = getClaudeClient()
    const message = await claude.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: MODERATOR_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content.find((b) => b.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const resultParsed = ModerationResult.safeParse(JSON.parse(jsonMatch[0]))
    if (!resultParsed.success) throw new Error('Invalid moderation shape')

    const result = resultParsed.data

    await supabase
      .from(table)
      .update({
        moderation_score: result.score,
        moderation_flags: result.flags,
      })
      .eq('id', content.id)

    return NextResponse.json(result)
  } catch (err) {
    console.error('Claude moderate error:', err)
    return NextResponse.json({ error: 'Moderation failed' }, { status: 502 })
  }
}
