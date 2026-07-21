import { NextResponse, type NextRequest } from 'next/server'
import { jsonSchema } from 'ai'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { aiGenerateObject } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 30

const Input = z.object({
  // Rough idea seed. Kept generous so creators can paste a short paragraph
  // (a memory, an anecdote) — not just a one-line topic — without a cryptic 400.
  description: z.string().min(2).max(1500),
  type: z.enum(['guide', 'review']),
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

  const { description, type } = parsed.data

  const prompt = type === 'review'
    ? `A Boss Daddy content creator wants to write a product review. Their rough idea: "${description}"

Give 3 distinct angles they could take on this review. Each angle should have a different emphasis (e.g. hands-on dad use, value for money, safety focus, long-term durability, comparison with alternatives). Return your result by calling the submit_suggestions tool. Each suggestion: productName (full proper product name, brand + model if you can infer it), angle (one phrase describing the editorial angle — max 60 chars), and keyFeatures (4–6 specific testable features a dad would care about).`
    : `A Boss Daddy content creator wants to write a dad-focused article. Their rough idea: "${description}"

Give 3 distinct angles they could take on this article — different in scope, audience level, or approach (e.g. beginner guide vs. expert tips vs. personal story). Return your result by calling the submit_suggestions tool. Each suggestion: topic (a clear, specific article title or topic — max 80 chars), angle (one phrase describing the editorial angle — max 60 chars), and keyPoints (4–6 concrete points the article should cover).`

  try {
    const out = await aiGenerateObject<Record<string, unknown>>({
      bucket: 'utility',
      tag: 'suggest-prompt',
      system: SUGGEST_SYSTEM,
      schema: type === 'review' ? REVIEW_SUGGEST_SCHEMA : GUIDE_SUGGEST_SCHEMA,
      prompt,
      maxOutputTokens: 900,
    })
    return NextResponse.json(out)
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('suggest-prompt error:', c.kind, '-', c.detail)
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}
