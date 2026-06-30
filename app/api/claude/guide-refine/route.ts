import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { createStructured } from '@/lib/claude/structured'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 90

// The model returns the refined draft by calling this tool — its input_schema
// is the shape, so the SDK validates it instead of us regex-parsing JSON.
const GUIDE_REFINE_TOOL: Anthropic.Tool = {
  name: 'submit_guide_refinement',
  description: 'Return the refined article draft.',
  input_schema: {
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
  },
}

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
    const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)
    const result = await createStructured({
      system: systemBlocks,
      messages: [{ role: 'user', content: prompt }],
      tool: GUIDE_REFINE_TOOL,
      maxTokens: 3800,
    })

    if (result.stopReason === 'max_tokens') {
      console.error('guide-refine hit max_tokens — output truncated')
      return NextResponse.json({ error: 'The refinement ran long and got cut off. Try again with a narrower instruction.' }, { status: 502 })
    }
    if (!result.data) return NextResponse.json({ error: 'Model returned unexpected format' }, { status: 502 })

    return NextResponse.json({ draft: result.data })
  } catch (err) {
    console.error('Guide refine error:', err)
    return NextResponse.json({ error: 'Refinement failed' }, { status: 502 })
  }
}
