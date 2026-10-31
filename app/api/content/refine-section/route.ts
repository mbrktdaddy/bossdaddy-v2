import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { aiGenerateTextWithMeta, failedCallMeta } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { buildBossDaddySystemMessages } from '@/lib/voiceProfile'
import { logGeneration } from '@/lib/content/generations'
import { INQUIRY_TRIGGER, PROMPT_VERSION } from '@/lib/content/prompts'
import { countTokens, sectionLabel, sectionToStructuredText, splitSections } from '@/lib/content/sections'
import { requireAuthor } from '@/lib/content/pipeline/route-helpers'
import { isInquiryCategory } from '@/lib/categories'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 90

// Patch-based refine (content pipeline plan, Phase 2): rewrite ONE section to
// an instruction. The model sees the section with its product tokens in
// place, the neighbours as read-only context, and returns prose only. Costs a
// fraction of the whole-document refine and can't touch anything it wasn't
// shown.
const TEMPERATURE = 0.5
const EFFORT = 'high' as const
const NEIGHBOUR_CHARS = 1200

const Input = z.object({
  contentType:  z.enum(['review', 'guide']),
  contentId:    z.string().uuid().optional(),
  title:        z.string().min(1).max(120),
  category:     z.string().min(1).max(80),
  productName:  z.string().max(120).optional(),
  content:      z.string().min(10),
  sectionIndex: z.number().int().min(0).max(40),
  instruction:  z.string().min(4).max(1000),
  inquiryMode:  z.boolean().optional().nullable(),
})

export async function POST(request: NextRequest) {
  const auth = await requireAuthor()
  if ('error' in auth) return auth.error
  const { supabase, userId } = auth

  const rl = await checkRateLimit(`refine-section:${userId}`, 'refine-section')
  if (!rl.success) return NextResponse.json({ error: 'Too many refinements. Try again in a bit.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = Input.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  const { contentType, contentId, title, category, productName, content, sectionIndex, instruction, inquiryMode } = parsed.data

  const sections = splitSections(content)
  const section = sections[sectionIndex]
  if (!section) return NextResponse.json({ error: 'No such section' }, { status: 400 })

  const inquiry = contentType === 'guide' && (inquiryMode ?? isInquiryCategory(category))
  const text = sectionToStructuredText(section)
  const tokens = countTokens(text)
  const tokenEntries = Object.entries(tokens)
  const prev = sections[sectionIndex - 1]
  const next = sections[sectionIndex + 1]
  const clip = (s: string) => (s.length > NEIGHBOUR_CHARS ? s.slice(0, NEIGHBOUR_CHARS) + ' …' : s)

  const prompt = `${inquiry ? `${INQUIRY_TRIGGER}\n\nThis piece runs in the inquiry register (see your system prompt): a witness, not a student — keep the visible reasoning, answer the opposing view where it's raised, and keep the position stated as a conviction; never soften it into a shrug.\n\n` : ''}STAGED DRAFTING — you are rewriting ONE section of an existing Boss Daddy ${contentType === 'review' ? 'product review' : 'guide'} to an editor's instruction. Everything outside this section stays as it is; you return only this section's prose.

Title: ${title}${productName ? `\nProduct: ${productName}` : ''}
Category: ${category}
Section: ${sectionLabel(section)} (${sectionIndex + 1} of ${sections.length})
${prev ? `
PREVIOUS SECTION (read-only context — do not rewrite or repeat it):
"""
${clip(sectionToStructuredText(prev))}
"""
` : ''}
THE SECTION TO REWRITE:
"""
${text}
"""
${next ? `
NEXT SECTION (read-only context — do not rewrite or repeat it):
"""
${clip(sectionToStructuredText(next))}
"""
` : ''}
INSTRUCTION: ${instruction}

RULES:
- Apply only what the instruction asks; keep every fact, number and firsthand detail that is already there unless the instruction says otherwise, and never add a usage claim, test result or family moment that isn't in the current text.
- ${tokenEntries.length
      ? `Product links: this section contains ${tokenEntries.map(([s, n]) => `${n} × [[BUY:${s}]]`).join(', ')}. Keep exactly those tokens, written exactly like that, placed where they still make sense. Add none, drop none.`
      : 'Product links: this section has no [[BUY:]] tokens — add none.'}
- Keep the first-person dad voice, the house rules, and roughly the same length unless told to lengthen or shorten.
- Return the section's prose ONLY: no heading, no title, no preamble, no commentary, no JSON, no # or ## headings, no code fences, no tables. Paragraphs separated by a blank line. The text may carry light Markdown — "- " bullets, "1." numbered items, "### " sub-heads, "> " pull-quotes, **bold** — keep what is there in the same marks (a numbered list stays numbered); add a list only if the instruction asks for one.`

  const startedAt = Date.now()
  const words = text.split(/\s+/).filter(Boolean).length
  const budget = Math.min(4000, Math.max(1200, words * 4 + 600))
  try {
    const system = await buildBossDaddySystemMessages(supabase, userId)
    const { text: raw, meta } = await aiGenerateTextWithMeta({
      bucket: 'content',
      tag: 'refine-section',
      system,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: budget,
      effort: EFFORT,
      temperature: TEMPERATURE,
      maxRetries: 2,
      promptVersion: PROMPT_VERSION,
    })
    const truncated = meta.finishReason === 'length'
    // The model occasionally echoes the heading despite the rule — drop it.
    let out = raw.trim().replace(/^#+\s.*\n+/, '')
    if (section.heading && out.toLowerCase().startsWith(section.heading.toLowerCase())) {
      out = out.slice(section.heading.length).replace(/^[\s:—-]+/, '')
    }
    const warnings: string[] = []
    const after = countTokens(out)
    for (const [slug, n] of tokenEntries) {
      if ((after[slug] ?? 0) !== n) warnings.push(`Product link [[BUY:${slug}]] count changed (${n} → ${after[slug] ?? 0}) — check it before accepting.`)
    }
    for (const slug of Object.keys(after)) {
      if (!(slug in tokens)) warnings.push(`A product link appeared that wasn't there before: [[BUY:${slug}]].`)
    }

    await logGeneration(supabase, {
      userId, contentType, contentId: contentId ?? null, stage: 'refine', status: truncated ? 'truncated' : 'done',
      meta, effort: EFFORT, temperature: TEMPERATURE,
      input: { sectionIndex, heading: section.heading, instruction, words, prompt }, output: { text: out, warnings },
    })
    if (truncated || !out) {
      return NextResponse.json({ error: 'The rewrite ran long and was cut off — try a narrower instruction.' }, { status: 502 })
    }
    return NextResponse.json({ text: out, warnings, costUsd: meta.costUsd })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('refine-section error:', c.kind, '-', c.detail)
    await logGeneration(supabase, {
      userId, contentType, contentId: contentId ?? null, stage: 'refine', status: 'failed',
      meta: failedCallMeta('content', startedAt, c.kind), effort: EFFORT, temperature: TEMPERATURE,
      input: { sectionIndex, heading: section.heading, instruction, words },
    })
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}
