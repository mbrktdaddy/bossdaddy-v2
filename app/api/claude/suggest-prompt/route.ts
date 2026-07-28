import { NextResponse, type NextRequest } from 'next/server'
import { jsonSchema } from 'ai'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { aiGenerateObject } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { isInquiryCategory } from '@/lib/categories'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 30

const Input = z.object({
  // Rough idea seed. Kept generous so creators can paste a short paragraph
  // (a memory, an anecdote) — not just a one-line topic — without a cryptic 400.
  description: z.string().min(2).max(1500),
  type: z.enum(['guide', 'review']),
  // Guide-only. The wizard sends whatever category is selected (may be empty
  // before the operator picks one) so inquiry pillars get inquiry angles instead
  // of "beginner guide vs. expert tips". An explicit inquiryMode always wins.
  category: z.string().max(80).optional(),
  inquiryMode: z.boolean().optional(),
})

const SUGGEST_SYSTEM = `You help Boss Daddy content creators turn rough ideas into structured generation prompts.`

// One schema per content type — the suggestion shape differs (review vs guide).
const REVIEW_SUGGEST_SCHEMA = jsonSchema<Record<string, unknown>>({
  type: 'object',
  properties: {
    suggestions: { type: 'array', items: {
      type: 'object',
      properties: {
        productName: { type: 'string' },
        angle:       { type: 'string' },
        keyFeatures: { type: 'array', items: { type: 'string' } },
      },
      required: ['productName', 'angle', 'keyFeatures'],
    } },
  },
  required: ['suggestions'],
})

const GUIDE_SUGGEST_SCHEMA = jsonSchema<Record<string, unknown>>({
  type: 'object',
  properties: {
    suggestions: { type: 'array', items: {
      type: 'object',
      properties: {
        topic:     { type: 'string' },
        angle:     { type: 'string' },
        keyPoints: { type: 'array', items: { type: 'string' } },
      },
      required: ['topic', 'angle', 'keyPoints'],
    } },
  },
  required: ['suggestions'],
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { success } = await checkRateLimit(`suggest-prompt:${user.id}`, 'claude-aux')
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded — try again shortly.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = Input.safeParse(body)
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some(
      (i) => i.path[0] === 'description' && i.code === 'too_big',
    )
    const error = tooLong
      ? 'That idea is too long for the angle suggester — keep it under 1500 characters, or paste the full story into the brief below and skip Suggest.'
      : 'Invalid input'
    return NextResponse.json({ error }, { status: 400 })
  }

  const { description, type, category, inquiryMode } = parsed.data
  const inquiry = type === 'guide' && (inquiryMode ?? isInquiryCategory(category ?? ''))

  const guidePrompt = inquiry
    ? `A Boss Daddy content creator wants to write a discussion piece — a philosophical or moral question a father wrestles with honestly (meaning and purpose, faith and doubt, the existence of God, death, duty, conscience, what we're handing our kids). Their rough idea: "${description}"

Give 3 distinct angles — distinct in which QUESTION sits at the center, not in "beginner vs. expert". Each should be a real question worth thinking about AND one the piece can actually answer; no hot takes, no partisan framing, but no aimless wandering either. Return your result by calling the submit_suggestions tool. Each suggestion: topic (the piece's central question or title — max 80 chars), angle (one phrase describing the line of inquiry — max 60 chars), and keyPoints (4–6 moves the piece should make — the tension it names, the strongest opposing view it should engage, the distinction it turns on, and the answer or position it should land on). Keep each keyPoint to one terse phrase under 90 characters — these are notes for the writer, not prose.`
    : `A Boss Daddy content creator wants to write a dad-focused article. Their rough idea: "${description}"

Give 3 distinct angles they could take on this article — different in scope, audience level, or approach (e.g. beginner guide vs. expert tips vs. personal story). Return your result by calling the submit_suggestions tool. Each suggestion: topic (a clear, specific article title or topic — max 80 chars), angle (one phrase describing the editorial angle — max 60 chars), and keyPoints (4–6 concrete points the article should cover).`

  const prompt = type === 'review'
    ? `A Boss Daddy content creator wants to write a product review. Their rough idea: "${description}"

Give 3 distinct angles they could take on this review. Each angle should have a different emphasis (e.g. hands-on dad use, value for money, safety focus, long-term durability, comparison with alternatives). Return your result by calling the submit_suggestions tool. Each suggestion: productName (full proper product name, brand + model if you can infer it), angle (one phrase describing the editorial angle — max 60 chars), and keyFeatures (4–6 specific testable features a dad would care about).`
    : guidePrompt

  try {
    const out = await aiGenerateObject<Record<string, unknown>>({
      bucket: 'utility',
      tag: 'suggest-prompt',
      system: SUGGEST_SYSTEM,
      schema: type === 'review' ? REVIEW_SUGGEST_SCHEMA : GUIDE_SUGGEST_SCHEMA,
      prompt,
      // 900 truncated the inquiry variant (2026-07-28): its keyPoints are full
      // argumentative moves, not feature names, so three suggestions land near
      // 800 tokens of pure content — zero slack under the old cap.
      maxOutputTokens: 1600,
      // Pinned low rather than left at the provider default ('high'). This is a
      // short list against a fixed shape; extended thinking bought nothing and
      // spent the output budget, which is what actually caused the truncation
      // (21s + finishReason 'length' on a 900-token call).
      effort: 'low',
      // NOT zero — this is ideation, and the operator re-clicks it for fresh
      // angles, so identical output every time would be the bug. Tightened off
      // the provider default (~1.0) only enough to cut off-the-wall suggestions.
      temperature: 0.7,
    })
    return NextResponse.json(out)
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('suggest-prompt error:', c.kind, '-', c.detail)
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}
