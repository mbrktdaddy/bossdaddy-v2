import { NextResponse, type NextRequest } from 'next/server'
import { jsonSchema } from 'ai'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { buildBossDaddySystemMessages } from '@/lib/voiceProfile'
import { aiGenerateObject } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 90

// The model output is validated against this schema (reused from the old
// submit_guide_refinement tool's input_schema) — the SDK enforces it instead
// of us regex-parsing JSON from text.
const GUIDE_REFINE_SCHEMA = jsonSchema<Record<string, unknown>>({
  type: 'object',
  properties: {
      title:        { type: 'string' },
      excerpt:      { type: 'string' },
      tldr:         { type: 'string' },
      keyTakeaways: { type: 'array', items: { type: 'string' } },
      faqs:         { type: 'array', items: {
        type: 'object',
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
        required: ['question', 'answer'],
      } },
      introduction: { type: 'string' },
      sections:     { type: 'array', items: {
        type: 'object',
        properties: { heading: { type: 'string' }, body: { type: 'string' } },
        required: ['heading', 'body'],
      } },
      conclusion:   { type: 'string' },
    },
    required: ['title', 'excerpt', 'introduction', 'sections', 'conclusion'],
})

const FAQSchema = z.object({ question: z.string(), answer: z.string() })

const RefineInput = z.object({
  title:         z.string().min(1).max(120),
  category:      z.string().min(1).max(80),
  content:       z.string().min(10),
  instruction:   z.string().min(4).max(1000),
  tldr:          z.string().max(600).optional(),
  keyTakeaways:  z.array(z.string()).optional(),
  faqs:          z.array(FAQSchema).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(`refine:${user.id}`, 'refine')
  if (!rl.success) return NextResponse.json({ error: 'Too many refinements. Try again in an hour.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = RefineInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { title, category, content, instruction, tldr, keyTakeaways, faqs } = parsed.data

  // Strip HTML tags so Claude receives clean readable text — avoids nested-quote JSON breakage
  const plainText = content
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const contentBlocksContext = [
    tldr ? `Current TL;DR: ${tldr}` : null,
    keyTakeaways?.length ? `Current Key Takeaways:\n${keyTakeaways.map((t, i) => `${i + 1}. ${t}`).join('\n')}` : null,
    faqs?.length ? `Current FAQs:\n${faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}` : null,
  ].filter(Boolean).join('\n\n')

  const prompt = `You are editing an existing Boss Daddy guide. Apply ONLY the requested changes — preserve everything else.

Title: ${title}
Category: ${category}

Current article text:
${plainText}
${contentBlocksContext ? `\n${contentBlocksContext}\n` : ''}
Refinement instructions: ${instruction}

Return your result by calling the submit_guide_refinement tool. Field guidance: title is the updated title if the instructions require it, otherwise the original; excerpt is the updated card sentence if needed, otherwise the original (max 160 chars); tldr is the updated TL;DR if required, otherwise the original; keyTakeaways are the updated takeaways if required, otherwise the originals; faqs are question/answer pairs; introduction is the opening paragraph(s); each section has a heading and body; conclusion is the closing.

Important: Only change what the instructions specify. Keep the first-person dad voice throughout.`

  try {
    const systemMessages = await buildBossDaddySystemMessages(supabase, user.id)
    const draft = await aiGenerateObject<Record<string, unknown>>({
      bucket: 'content',
      tag: 'guide-refine',
      schema: GUIDE_REFINE_SCHEMA,
      system: systemMessages,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 3800,
      maxRetries: 4,
    })
    return NextResponse.json({ draft })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('guide-refine error:', c.kind, '-', c.detail)
    // Truncated output is incomplete and unsafe to apply — say so plainly.
    if (c.kind === 'truncated') {
      return NextResponse.json({ error: 'The refinement ran long and got cut off. Try again with a narrower instruction.' }, { status: 502 })
    }
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}
