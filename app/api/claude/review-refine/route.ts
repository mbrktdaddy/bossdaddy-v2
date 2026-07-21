import { NextResponse, type NextRequest } from 'next/server'
import { jsonSchema } from 'ai'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { buildBossDaddySystemMessages } from '@/lib/voiceProfile'
import { aiGenerateObject } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 120

const RefineInput = z.object({
  title:        z.string().min(1).max(120),
  product_name: z.string().min(1).max(120),
  category:     z.string().min(1).max(80),
  content:      z.string().min(10),
  instruction:  z.string().min(4).max(1000),
})

// The shape the model must return — the SDK validates its output against this
// schema (reused from the old submit_refined_review tool) instead of us parsing
// free-text JSON.
const REFINE_SCHEMA = jsonSchema<Record<string, unknown>>({
  type: 'object',
  properties: {
      title:        { type: 'string', description: 'Updated title if instructions require it, otherwise the original' },
      excerpt:      { type: 'string', description: 'Updated excerpt if needed, max 160 chars' },
      tldr:         { type: 'string', description: '2–3 sentence skimmer summary; update if the verdict shifts' },
      keyTakeaways: { type: 'array', items: { type: 'string' }, description: '3–5 specific bullets' },
      bestFor:      { type: 'array', items: { type: 'string' }, description: '3–4 buyer profiles' },
      notFor:       { type: 'array', items: { type: 'string' }, description: '2–3 skip scenarios' },
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
      verdict:      { type: 'string' },
      rating:       { type: 'number', description: 'Overall 1-10' },
      pros:         { type: 'array', items: { type: 'string' } },
      cons:         { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'excerpt', 'introduction', 'sections', 'verdict', 'pros', 'cons'],
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

  const { title, product_name, category, content, instruction } = parsed.data

  // Extract product slug from any resolved affiliate anchor so token placement
  // rules survive a refine cycle (resolved <a data-product-slug> → [[BUY:slug]])
  const slugMatch = content.match(/data-product-slug="([^"]+)"/)
  const productSlug = slugMatch?.[1] ?? null

  const plainText = content
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const prompt = `You are editing an existing Boss Daddy product review. Apply ONLY the requested changes — preserve everything else.

Title: ${title}
Product: ${product_name}
Category: ${category}${productSlug ? `\nProduct slug: ${productSlug}` : ''}

Current review text:
${plainText}

Refinement instructions: ${instruction}

Apply the changes, then return the full updated review by calling the submit_refined_review tool. Update only what the instructions specify; preserve everything else and keep the first-person dad voice throughout.`

  try {
    const systemMessages = await buildBossDaddySystemMessages(supabase, user.id)
    const draft = await aiGenerateObject<Record<string, unknown>>({
      bucket: 'content',
      tag: 'review-refine',
      schema: REFINE_SCHEMA,
      system: systemMessages,
      messages: [{ role: 'user', content: prompt }],
      // A full-review refine regenerates every field (sections, faqs, lists);
      // 8000 leaves room for the whole document so the output isn't truncated.
      maxOutputTokens: 8000,
      maxRetries: 4,
    })
    return NextResponse.json({ draft })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('review-refine error:', c.kind, '-', c.detail)
    // Truncated output is incomplete and unsafe to apply — say so plainly.
    if (c.kind === 'truncated') {
      return NextResponse.json({ error: 'The refine ran long and was cut off — try a more specific instruction.' }, { status: 502 })
    }
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}
