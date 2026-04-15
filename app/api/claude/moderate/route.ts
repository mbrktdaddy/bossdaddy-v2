import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClaudeClient, MODEL, MODERATOR_SYSTEM } from '@/lib/claude/client'
import { z } from 'zod'

const ModerateInput = z.object({
  reviewId: z.string().uuid(),
})

// Internal endpoint — called server-side when a review is submitted.
// Authenticated via SUPABASE_SERVICE_ROLE_KEY implicitly (admin client).
// Optionally accepts X-Internal-Secret header for added protection.
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_API_SECRET && process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = ModerateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: review, error } = await supabase
    .from('reviews')
    .select('id, title, content, has_affiliate_links, disclosure_acknowledged')
    .eq('id', parsed.data.reviewId)
    .single()

  if (error || !review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  const prompt = `Review the following content submission:

Title: ${review.title}
Has affiliate links: ${review.has_affiliate_links}
Disclosure acknowledged: ${review.disclosure_acknowledged}

Content:
${review.content.slice(0, 4000)}

Return JSON: { "score": number, "flags": string[], "recommendation": "approve"|"review"|"reject" }`

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

    const result = JSON.parse(jsonMatch[0]) as {
      score: number
      flags: string[]
      recommendation: 'approve' | 'review' | 'reject'
    }

    // Persist moderation result
    await supabase
      .from('reviews')
      .update({
        moderation_score: result.score,
        moderation_flags: result.flags,
      })
      .eq('id', review.id)

    return NextResponse.json(result)
  } catch (err) {
    console.error('Claude moderate error:', err)
    return NextResponse.json({ error: 'Moderation failed' }, { status: 502 })
  }
}
