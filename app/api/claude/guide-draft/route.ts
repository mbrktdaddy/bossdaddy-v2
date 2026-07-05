import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { createStructured } from '@/lib/claude/structured'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

// Deep guides generate up to 8000 tokens (5–8 long sections + blocks), which can
// take 1–2 min under load; 90s was cutting it close for the comprehensive tier.
export const maxDuration = 180

// Piece-type depth toggle (Decision A, 2026-07-05). Drives the generated
// structure, which structured content blocks are forced, AND the token budget:
//   essay → free-form narrative, no forced TL;DR/takeaways/FAQ, tight budget
//   howto → tight + scannable, TL;DR + key takeaways, no forced FAQ
//   guide → comprehensive (all blocks), long-form budget
type PieceType = 'essay' | 'howto' | 'guide'

// The model returns the draft by calling this tool — its input_schema is the
// shape, so the SDK validates it instead of us regex-parsing JSON from text.
// Built per piece type so essays/how-tos aren't forced to emit blocks that
// would break their voice (and burn tokens the wizard then discards).
function buildGuideTool(pieceType: PieceType): Anthropic.Tool {
  const base: Record<string, unknown> = {
    title:           { type: 'string' },
    excerpt:         { type: 'string' },
    introduction:    { type: 'string' },
    sections:        { type: 'array', items: {
      type: 'object',
      properties: { heading: { type: 'string' }, body: { type: 'string' } },
      required: ['heading', 'body'],
    } },
    conclusion:      { type: 'string' },
    heroImagePrompt: { type: 'string' },
    inlineImages:    { type: 'array', items: {
      type: 'object',
      properties: {
        afterHeading: { type: 'string' }, prompt: { type: 'string' },
        altText: { type: 'string' }, caption: { type: 'string' },
      },
      required: ['afterHeading', 'prompt', 'altText', 'caption'],
    } },
    suggestedTags:   { type: 'array', items: { type: 'string' } },
  }

  const tldr = { type: 'string' }
  const keyTakeaways = { type: 'array', items: { type: 'string' } }
  const faqs = { type: 'array', items: {
    type: 'object',
    properties: { question: { type: 'string' }, answer: { type: 'string' } },
    required: ['question', 'answer'],
  } }

  // Which structured content blocks this piece type includes (and forces).
  const blocks: Record<string, unknown> =
    pieceType === 'essay' ? {} :
    pieceType === 'howto' ? { tldr, keyTakeaways } :
    { tldr, keyTakeaways, faqs }

  const commonRequired = [
    'title', 'excerpt', 'introduction', 'sections',
    'conclusion', 'heroImagePrompt', 'inlineImages', 'suggestedTags',
  ]

  return {
    name: 'submit_guide',
    description: 'Return the finished dad-focused article draft.',
    input_schema: {
      type: 'object',
      properties: { ...base, ...blocks },
      required: [...commonRequired, ...Object.keys(blocks)],
    },
  }
}

const GuideDraftInput = z.object({
  topic: z.string().min(4).max(150),
  category: z.string().min(2).max(80),
  pieceType: z.enum(['essay', 'howto', 'guide']).default('guide'),
  keyPoints: z.array(z.string()).max(15).default([]),
  context: z.string().max(6000).optional(),
  targetAudience: z.string().max(200).optional(),
  productSlugs: z.array(z.string().regex(/^[a-z0-9-]+$/).max(80)).max(15).optional(),
  // 'auto' lets Claude pick (2–3 images); a number forces exactly that many.
  imageSlots: z.union([z.literal('auto'), z.number().int().min(0).max(6)]).default('auto'),
})

// Per-type prompt fragments + token budget. Deep guides get the long budget;
// essays/how-tos stay tight (which is also the point — scannable, not padded).
const PIECE_CONFIG: Record<PieceType, {
  label: string
  maxTokens: number
  structure: string
  contentBlocks: string
  fieldGuidanceBlocks: string
}> = {
  essay: {
    label: 'personal essay',
    maxTokens: 3800,
    structure: `STRUCTURE (personal essay — narrative, first-person, voice-forward):
- Introduction: open inside a real moment or memory that pulls the reader in — no throat-clearing, no "in this article".
- Sections: 4–7 flowing sections that move the story or argument forward. Each has a heading and 150–300 words of prose. Let paragraphs breathe — this is not a listicle.
- Conclusion: 1–2 paragraphs that land the reflection honestly, without a bow on top.
- Separate paragraphs within each section with \\n\\n`,
    contentBlocks: '',
    fieldGuidanceBlocks: '',
  },
  howto: {
    label: 'how-to guide',
    maxTokens: 3800,
    structure: `STRUCTURE (how-to — tight and scannable):
- Introduction: 2–3 sentences naming the problem and what the reader will be able to do.
- Sections: 3–5 sections, each 120–200 words, each a clear step or decision with a concrete takeaway. Keep paragraphs short — a time-poor dad should be able to skim it on a phone.
- Conclusion: 1–2 sentences with the single most important next step.
- Separate paragraphs within each section with \\n\\n`,
    contentBlocks: `CONTENT BLOCKS (required — these render as structured UI elements, not prose):
- tldr: 2–3 sentence plain-English summary for skimmers. Lead with the main takeaway.
- keyTakeaways: 3–5 specific, actionable bullet points readers can act on immediately.`,
    fieldGuidanceBlocks: ' tldr is 2–3 plain-English skimmer sentences; keyTakeaways are 3–5 specific, actionable items;',
  },
  guide: {
    label: 'guide',
    maxTokens: 8000,
    structure: `STRUCTURE (comprehensive guide):
- Introduction: 2–3 sentences that hook the reader with a real scenario (first-person dad).
- Sections: 5–8 sections, each 200–350 words, each with a clear practical takeaway. Cover the topic thoroughly — the reader shouldn't need to open another article.
- Conclusion: 1–2 paragraphs with a specific next step or recommendation.
- Separate paragraphs within each section with \\n\\n`,
    contentBlocks: `CONTENT BLOCKS (required — these render as structured UI elements, not prose):
- tldr: 2–3 sentence plain-English summary for skimmers. Lead with the main takeaway.
- keyTakeaways: 3–5 specific, actionable bullet points. Not a rehash of the intro — highlight the most useful or surprising insights.
- faqs: 3–5 Q&A pairs covering the most common questions on this topic. Write questions the way a real dad searching Google would phrase them. Answers 2–3 sentences each.`,
    fieldGuidanceBlocks: ' tldr is 2–3 plain-English skimmer sentences; keyTakeaways are 3–5 specific, actionable items; faqs are 3–5 question/answer pairs (answers 2–3 sentences);',
  },
}

function inlineImagesInstruction(slots: number | 'auto'): string {
  if (slots === 0) {
    return 'INLINE IMAGES:\n- Do not include any inline images. Return an empty array for "inlineImages".'
  }
  if (slots === 'auto') {
    return `INLINE IMAGES:
- Suggest 2–3 inline image placements that would meaningfully improve the article. Each maps to a section heading you also generated above (use the exact heading text in "afterHeading").
- Prompt style: editorial photography, warm/natural lighting, realistic setting, no people, no text. Under 180 chars.
- "altText" is the a11y description (what a reader would describe if it were rendered). Keep under 120 chars.
- "caption" is a short editorial sentence readers see under the image — human, not a restatement of the alt. Under 100 chars.`
  }
  return `INLINE IMAGES:
- Suggest exactly ${slots} inline image placement${slots === 1 ? '' : 's'} that would meaningfully improve the article. Each maps to a section heading you also generated above (use the exact heading text in "afterHeading").
- Prompt style: editorial photography, warm/natural lighting, realistic setting, no people, no text. Under 180 chars.
- "altText" is the a11y description (what a reader would describe if it were rendered). Keep under 120 chars.
- "caption" is a short editorial sentence readers see under the image — human, not a restatement of the alt. Under 100 chars.`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success, remaining, reset } = await checkRateLimit(`guide-draft:${user.id}`)
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. You can generate 10 drafts per hour.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining), 'X-RateLimit-Reset': String(reset) } }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = GuideDraftInput.safeParse(body)
  if (!parsed.success) {
    console.error('guide-draft validation failed:', parsed.error.flatten())
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { topic, category, pieceType, keyPoints, context, targetAudience, productSlugs, imageSlots } = parsed.data
  const slugs = (productSlugs ?? []).filter(Boolean)
  const brief = context?.trim()
  const cfg = PIECE_CONFIG[pieceType]

  const prompt = `Write a dad-focused ${cfg.label} on this topic:

Topic: ${topic}
Category: ${category}${keyPoints.length ? `\nKey Points: ${keyPoints.join(', ')}` : ''}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}${slugs.length ? `\nProduct slugs: ${slugs.join(', ')}` : ''}
${brief ? `
AUTHOR'S BRIEF / SOURCE MATERIAL (required — ground the piece in these specifics):
"""
${brief}
"""
- Treat the brief as the author's real, first-hand context. Use its specific facts, numbers, names, and personal details — do not invent competing ones or contradict them.
- Write in this author's voice and from their lived experience as described. Weave the concrete specifics (figures, brand names, the personal arc) into the prose rather than restating them as a list.
- If the brief implies a story or progression, honor that narrative arc.
` : ''}
${cfg.structure}

${cfg.contentBlocks ? `${cfg.contentBlocks}\n\n` : ''}SEO: Include the main topic phrase naturally in the intro and at least one section heading.

${inlineImagesInstruction(imageSlots)}

TAGS: Pick 3–6 slugs from this controlled vocabulary that best describe this piece. Be selective — only tag what genuinely applies.
Editorial (pick at most 1): top-pick, best-value, hidden-gem
Life Stage: pregnancy, newborn, infant, toddler, preschool, school-age, teen
Use Case: travel, daily, occasional, gift-idea, gear-haul
Topic: home-improvement, workshop, automotive, yard-work, kitchen-tools, outdoor-cooking, mental-health, mindfulness, self-help, faith, formula-feeding, baby-sleep, strollers, car-seats, baby-carriers, diapering, nursery-gear, power-tools, hand-tools, storage-org, camping, hiking, fishing, hunting, water-sports, smart-home, wearables, audio-gear, edc-carry, truck-gear, detailing, cast-iron, meal-prep, fitness, home-gym, cleaning, organization

Return your result by calling the submit_guide tool. Field guidance: title is a specific, useful title (max 80 chars, include the topic keyword); excerpt is one punchy card sentence (max 160 chars);${cfg.fieldGuidanceBlocks} introduction opens the piece per the structure above; each section has a clear heading and a body with paragraphs separated by \\n\\n; conclusion follows the structure above (separate paragraphs with \\n\\n); heroImagePrompt is an editorial-photography hero prompt (specific real-world objects, natural daylight or warm indoor light, no people, no text, under 180 chars); each inlineImages.afterHeading MUST match one of your section headings; suggestedTags are 3–6 slugs from the controlled vocabulary above.`

  const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)
  let result
  try {
    result = await createStructured({
      system: systemBlocks,
      messages: [{ role: 'user', content: prompt }],
      tool: buildGuideTool(pieceType),
      maxTokens: cfg.maxTokens,
      temperature: 0.8,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Claude API error (guide-draft):', msg)
    const isTimeout = /timeout|timed.?out|deadline/i.test(msg)
    const isOverload = /overload|529|capacity/i.test(msg)
    return NextResponse.json({
      error: isTimeout
        ? 'Generation timed out — the AI is busy. Please wait a moment and try again.'
        : isOverload
        ? 'The AI service is currently overloaded. Please try again in a minute.'
        : `AI service error: ${msg.slice(0, 120)}`,
    }, { status: 502 })
  }

  // Truncation guard: a cut-off tool input is unsafe to use — say so plainly.
  if (result.stopReason === 'max_tokens') {
    console.error('guide-draft hit max_tokens — output truncated')
    return NextResponse.json({ error: 'The draft ran long and got cut off. Try again, or trim the brief and regenerate.' }, { status: 502 })
  }

  const draft = result.data
  if (!draft) {
    return NextResponse.json({ error: 'AI returned an unexpected format — please try again.' }, { status: 502 })
  }

  // Extract the hero image prompt — return it so the form can pre-fill the
  // editable prompt field. Inline image prompts travel with the draft itself.
  const imagePrompt: string = (draft.heroImagePrompt as string)
    ?? (draft.imagePrompts as Record<string, string> | undefined)?.hero
    ?? `Photorealistic lifestyle photo for a dad-focused article about ${topic}, no people, objects and setting only`

  const suggestedTags = Array.isArray(draft.suggestedTags) ? draft.suggestedTags as string[] : []

  const { heroImagePrompt: _heroOmit, imagePrompts: _legacyOmit, suggestedTags: _tags, ...cleanDraft } = draft

  return NextResponse.json({ draft: cleanDraft, imagePrompt, suggestedTags, remaining })
}
