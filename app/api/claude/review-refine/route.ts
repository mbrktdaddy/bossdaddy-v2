import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { createStructured } from '@/lib/claude/structured'
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

// The shape the model must return — enforced as the refine tool's input_schema
// so the SDK hands back a validated object instead of free-text JSON to parse.
const REFINE_TOOL: Anthropic.Tool = {
  name: 'submit_refined_review',
  description: 'Return the full updated review after applying the requested changes.',
  input_schema: {
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
  },
}

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
    const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)
    const { data: draft, stopReason } = await createStructured({
      system: systemBlocks,
      messages: [{ role: 'user', content: prompt }],
      tool: REFINE_TOOL,
      // A full-review refine regenerates every field (sections, faqs, lists);
      // 8000 leaves room for the whole document so the tool input isn't truncated.
      maxTokens: 8000,
      maxRetries: 4,
    })

    // Truncated tool input is incomplete and unsafe to apply — say so plainly.
    if (stopReason === 'max_tokens') {
      return NextResponse.json({ error: 'The refine ran long and was cut off — try a more specific instruction.' }, { status: 502 })
    }
    if (!draft) {
      return NextResponse.json({ error: 'Model returned an unexpected format — try again.' }, { status: 502 })
    }
    return NextResponse.json({ draft })
  } catch (err) {
    console.error('Review refine error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    const isOverload = /overload|529|capacity/i.test(msg)
    const isTimeout = /timeout|timed.?out|deadline/i.test(msg)
    return NextResponse.json({
      error: isOverload
        ? 'The AI service is busy right now (overloaded). Wait a minute and try again.'
        : isTimeout
        ? 'The refine timed out — try again in a moment.'
        : 'Refinement failed',
    }, { status: 502 })
  }
}
