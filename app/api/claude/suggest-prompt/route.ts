import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { z } from 'zod'

export const maxDuration = 30

const Input = z.object({
  description: z.string().min(2).max(300),
  type: z.enum(['guide', 'review']),
})

const SUGGEST_SYSTEM = `You help Boss Daddy content creators turn rough ideas into structured generation prompts.
Return valid JSON only — no markdown, no code fences.`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = Input.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { description, type } = parsed.data

  const prompt = type === 'review'
    ? `A Boss Daddy content creator wants to write a product review. Their rough idea: "${description}"

Give 3 distinct angles they could take on this review. Each angle should have a different emphasis (e.g. hands-on dad use, value for money, safety focus, long-term durability, comparison with alternatives). Return JSON:
{
  "suggestions": [
    {
      "productName": "string (full proper product name, brand + model if you can infer it)",
      "angle": "string (one phrase describing the editorial angle — max 60 chars)",
      "keyFeatures": ["string"] (4–6 specific testable features a dad would care about)
    }
  ]
}`
    : `A Boss Daddy content creator wants to write a dad-focused article. Their rough idea: "${description}"

Give 3 distinct angles they could take on this article — different in scope, audience level, or approach (e.g. beginner guide vs. expert tips vs. personal story). Return JSON:
{
  "suggestions": [
    {
      "topic": "string (a clear, specific article title or topic — max 80 chars)",
      "angle": "string (one phrase describing the editorial angle — max 60 chars)",
      "keyPoints": ["string"] (4–6 concrete points the article should cover)
    }
  ]
}`

  try {
    const message = await getClaudeClient().messages.create({
      model: MODEL,
      max_tokens: 900,
      system: [{ type: 'text', text: SUGGEST_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content.find((b) => b.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Model returned unexpected format' }, { status: 502 })

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    console.error('Suggest prompt error:', err)
    return NextResponse.json({ error: 'Suggestion failed' }, { status: 502 })
  }
}
