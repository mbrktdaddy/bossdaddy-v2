import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { buildBossDaddySystemMessages } from '@/lib/voiceProfile'
import { aiGenerateObjectWithMeta, failedCallMeta } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { ReviewRefineOutput, type ReviewRefine } from '@/lib/content/schemas'
import { htmlToStructuredText } from '@/lib/content/html'
import { PROMPT_VERSION } from '@/lib/content/prompts'
import { logGeneration } from '@/lib/content/generations'
import { extractProductSlugs } from '@/lib/inline-content'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 120

// Whole-document refine — the fallback once the section patch ships (content
// pipeline plan, Phase 2). Until then this is the only edit path, so it must at
// least not damage what it can't see: pros/cons are optional in the output and
// the prompt says to omit them unless the instruction touches them, so the
// workspace keeps the author's lists.
const TEMPERATURE = 0.5

const FAQSchema = z.object({ question: z.string(), answer: z.string() })

const RefineInput = z.object({
  title:        z.string().min(1).max(120),
  product_name: z.string().min(1).max(120),
  category:     z.string().min(1).max(80),
  content:      z.string().min(10),
  instruction:  z.string().min(4).max(1000),
  contentId:    z.string().uuid().optional(),
  // The blocks the model may be asked to change — shown so an instruction like
  // "add a con about the latches" edits the real list instead of inventing one.
  pros:         z.array(z.string()).optional(),
  cons:         z.array(z.string()).optional(),
  tldr:         z.string().max(600).optional().nullable(),
  keyTakeaways: z.array(z.string()).optional(),
  bestFor:      z.array(z.string()).optional(),
  notFor:       z.array(z.string()).optional(),
  faqs:         z.array(FAQSchema).optional(),
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

  const { title, product_name, category, content, instruction, contentId, pros, cons, tldr, keyTakeaways, bestFor, notFor, faqs } = parsed.data

  const list = (label: string, items?: string[]) => items?.length ? `${label}:\n${items.map((i, n) => `${n + 1}. ${i}`).join('\n')}` : null
  const blocksContext = [
    tldr ? `Current TL;DR: ${tldr}` : null,
    list('Current Key Takeaways', keyTakeaways),
    list('Current Best For', bestFor),
    list('Current Not For', notFor),
    list('Current Pros', pros),
    list('Current Cons', cons),
    faqs?.length ? `Current FAQs:\n${faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}` : null,
  ].filter(Boolean).join('\n\n')

  // Every resolved affiliate anchor (<a data-product-slug>) → the slug line the
  // system prompt's PRODUCT LINKS rules key off, so token placement survives a
  // refine. One slug = the three-token rule; several = one token each.
  const slugs = extractProductSlugs(content)
  const slugLine = slugs.length === 1
    ? `\nProduct slug: ${slugs[0]}`
    : slugs.length > 1 ? `\nProduct slugs: ${slugs.join(', ')}` : ''

  // Structured text — "## " marks each heading — instead of the old one-line
  // collapse, so "preserve everything else" has a structure to preserve.
  const structured = htmlToStructuredText(content)

  const prompt = `You are editing an existing Boss Daddy product review. Apply ONLY the requested changes — preserve everything else, including section headings and order, unless the instruction says otherwise.

Title: ${title}
Product: ${product_name}
Category: ${category}${slugLine}

Current review text ("## " marks a section heading):
${structured}
${blocksContext ? `\n${blocksContext}\n` : ''}
Refinement instructions: ${instruction}

Return the full updated review. Fields you were not asked to change must come back unchanged. OMIT pros, cons, tldr, keyTakeaways, bestFor, notFor and faqs entirely unless the instruction explicitly asks you to change them — the author's current lists are kept when you leave them out. Keep the first-person dad voice throughout.`

  const startedAt = Date.now()
  try {
    const systemMessages = await buildBossDaddySystemMessages(supabase, user.id)
    const { object, meta } = await aiGenerateObjectWithMeta<ReviewRefine>({
      bucket: 'content',
      tag: 'review-refine',
      schema: ReviewRefineOutput,
      system: systemMessages,
      messages: [{ role: 'user', content: prompt }],
      // A full-review refine regenerates every section; 8000 leaves room for the
      // whole document so the output isn't truncated.
      maxOutputTokens: 8000,
      temperature: TEMPERATURE,
      maxRetries: 4,
      promptVersion: PROMPT_VERSION,
    })
    await logGeneration(supabase, {
      userId: user.id, contentType: 'review', contentId: contentId ?? null, stage: 'refine', status: 'done',
      meta, temperature: TEMPERATURE, input: { title, product_name, category, instruction, slugs }, output: object,
    })
    return NextResponse.json({ draft: object, costUsd: meta.costUsd })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('review-refine error:', c.kind, '-', c.detail)
    await logGeneration(supabase, {
      userId: user.id, contentType: 'review', contentId: contentId ?? null, stage: 'refine',
      status: c.kind === 'truncated' ? 'truncated' : 'failed',
      meta: failedCallMeta('content', startedAt, c.kind), temperature: TEMPERATURE,
      input: { title, product_name, category, instruction, slugs },
    })
    // Truncated output is incomplete and unsafe to apply — say so plainly.
    if (c.kind === 'truncated') {
      return NextResponse.json({ error: 'The refine ran long and was cut off — try a more specific instruction.' }, { status: 502 })
    }
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}
