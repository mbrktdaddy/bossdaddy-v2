import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { buildBossDaddySystemMessages } from '@/lib/voiceProfile'
import { aiGenerateObjectWithMeta, failedCallMeta } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { GuideRefineOutput, type GuideRefine } from '@/lib/content/schemas'
import { htmlToStructuredText } from '@/lib/content/html'
import { INQUIRY_TRIGGER, PROMPT_VERSION } from '@/lib/content/prompts'
import { logGeneration } from '@/lib/content/generations'
import { extractProductSlugs } from '@/lib/inline-content'
import { isInquiryCategory } from '@/lib/categories'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

// A comprehensive guide re-emitted in full runs to ~9k tokens on the 5
// generation (the draft budget is 12k with thinking); 3800 truncated it.
export const maxDuration = 180

const TEMPERATURE = 0.5

const FAQSchema = z.object({ question: z.string(), answer: z.string() })

const RefineInput = z.object({
  title:         z.string().min(1).max(120),
  category:      z.string().min(1).max(80),
  content:       z.string().min(10),
  instruction:   z.string().min(4).max(1000),
  tldr:          z.string().max(600).optional(),
  keyTakeaways:  z.array(z.string()).optional(),
  faqs:          z.array(FAQSchema).optional(),
  // Keeps a refine pass from sanding the student-first inquiry voice back into
  // confident reviewer voice. The workspace passes the persisted value
  // (guides.inquiry_mode, mig 164); omitted = infer from the pillar.
  inquiryMode:   z.boolean().optional().nullable(),
  contentId:     z.string().uuid().optional(),
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

  const { title, category, content, instruction, tldr, keyTakeaways, faqs, inquiryMode, contentId } = parsed.data
  const inquiry = inquiryMode ?? isInquiryCategory(category)

  // Guides carry one token per linked product; list them so the refine keeps
  // them (the old route listed none, so every refine stripped every link).
  // Inquiry pieces never carry product links.
  const slugs = inquiry ? [] : extractProductSlugs(content)
  const slugLine = slugs.length ? `\nProduct slugs: ${slugs.join(', ')}` : ''

  const structured = htmlToStructuredText(content)

  const contentBlocksContext = [
    tldr ? `Current TL;DR: ${tldr}` : null,
    keyTakeaways?.length ? `Current Key Takeaways:\n${keyTakeaways.map((t, i) => `${i + 1}. ${t}`).join('\n')}` : null,
    faqs?.length ? `Current FAQs:\n${faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}` : null,
  ].filter(Boolean).join('\n\n')

  const inquiryHeader = inquiry
    ? `${INQUIRY_TRIGGER}

This piece runs in the inquiry register (see your system prompt): humble in posture, decisive in substance. Keep the visible reasoning and the honest treatment of opposing views — but also keep it committed to an answer. Don't flatten it into a hedge, and don't flatten it into a verdict handed down without reasoning. Do not add practical takeaways, action items or product recommendations.

`
    : ''

  const prompt = `${inquiryHeader}You are editing an existing Boss Daddy guide. Apply ONLY the requested changes — preserve everything else, including section headings and order, unless the instruction says otherwise.

Title: ${title}
Category: ${category}${slugLine}

Current article text ("## " marks a section heading):
${structured}
${contentBlocksContext ? `\n${contentBlocksContext}\n` : ''}
Refinement instructions: ${instruction}

Return the full updated guide. Fields you were not asked to change must come back unchanged. OMIT tldr, keyTakeaways and faqs entirely unless the instruction explicitly asks you to change them — the author's current blocks are kept when you leave them out. Keep the first-person dad voice throughout.`

  const startedAt = Date.now()
  try {
    const systemMessages = await buildBossDaddySystemMessages(supabase, user.id)
    const { object, meta } = await aiGenerateObjectWithMeta<GuideRefine>({
      bucket: 'content',
      tag: 'guide-refine',
      schema: GuideRefineOutput,
      system: systemMessages,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 9000,
      temperature: TEMPERATURE,
      maxRetries: 4,
      promptVersion: PROMPT_VERSION,
    })
    await logGeneration(supabase, {
      userId: user.id, contentType: 'guide', contentId: contentId ?? null, stage: 'refine', status: 'done',
      meta, temperature: TEMPERATURE, input: { title, category, instruction, inquiry, slugs }, output: object,
    })
    return NextResponse.json({ draft: object, costUsd: meta.costUsd })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('guide-refine error:', c.kind, '-', c.detail)
    await logGeneration(supabase, {
      userId: user.id, contentType: 'guide', contentId: contentId ?? null, stage: 'refine',
      status: c.kind === 'truncated' ? 'truncated' : 'failed',
      meta: failedCallMeta('content', startedAt, c.kind), temperature: TEMPERATURE,
      input: { title, category, instruction, inquiry, slugs },
    })
    // Truncated output is incomplete and unsafe to apply — say so plainly.
    if (c.kind === 'truncated') {
      return NextResponse.json({ error: 'The refinement ran long and got cut off. Try again with a narrower instruction.' }, { status: 502 })
    }
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}
