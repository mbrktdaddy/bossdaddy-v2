import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { createStructured } from '@/lib/claude/structured'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 90

// The model returns the draft by calling this tool — its input_schema is the
// shape, so the SDK validates it instead of us regex-parsing JSON from text.
const GUIDE_DRAFT_TOOL: Anthropic.Tool = {
  name: 'submit_guide',
  description: 'Return the finished dad-focused article draft.',
  input_schema: {
    type: 'object',
    properties: {
      title:           { type: 'string' },
      excerpt:         { type: 'string' },
      tldr:            { type: 'string' },
      keyTakeaways:    { type: 'array', items: { type: 'string' } },
      faqs:            { type: 'array', items: {
        type: 'object',
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
        required: ['question', 'answer'],
      } },
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
    },
    required: [
      'title', 'excerpt', 'tldr', 'keyTakeaways', 'faqs', 'introduction',
      'sections', 'conclusion', 'heroImagePrompt', 'inlineImages', 'suggestedTags',
    ],
  },
}

const GuideDraftInput = z.object({
  topic: z.string().min(4).max(150),
  category: z.string().min(2).max(80),
  keyPoints: z.array(z.string()).max(15).default([]),
  context: z.string().max(6000).optional(),
  targetAudience: z.string().max(200).optional(),
  productSlugs: z.array(z.string().regex(/^[a-z0-9-]+$/).max(80)).max(15).optional(),
  // 'auto' lets Claude pick (2–3 images); a number forces exactly that many.
  imageSlots: z.union([z.literal('auto'), z.number().int().min(0).max(6)]).default('auto'),
})

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

  const { topic, category, keyPoints, context, targetAudience, productSlugs, imageSlots } = parsed.data
  const slugs = (productSlugs ?? []).filter(Boolean)
  const brief = context?.trim()

  const prompt = `Write a dad-focused article on this topic:

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
STRUCTURE REQUIREMENTS:
- Introduction: 2–3 sentences that hook the reader with a real scenario (first-person dad)
- Sections: 3–5 sections, each 150–250 words, with a clear practical takeaway
- Conclusion: 1–2 paragraphs with a specific next step or recommendation
- Separate paragraphs within each section with \\n\\n

CONTENT BLOCKS (required — these render as structured UI elements, not prose):
- tldr: 2–3 sentence plain-English summary for skimmers. Lead with the main takeaway.
- keyTakeaways: 3–5 specific, actionable bullet points. Not a rehash of the intro — highlight the most useful or surprising insights.
- faqs: 3–5 Q&A pairs covering the most common questions on this topic. Write questions the way a real dad searching Google would phrase them. Answers 2–3 sentences each.

SEO: Include the main topic phrase naturally in the intro and at least one section heading.

${inlineImagesInstruction(imageSlots)}

TAGS: Pick 3–6 slugs from this controlled vocabulary that best describe this guide. Be selective — only tag what genuinely applies.
Editorial (pick at most 1): top-pick, best-value, hidden-gem
Life Stage: pregnancy, newborn, infant, toddler, preschool, school-age, teen
Use Case: travel, daily, occasional, gift-idea, gear-haul
Topic: home-improvement, workshop, automotive, yard-work, kitchen-tools, outdoor-cooking, mental-health, mindfulness, self-help, faith, formula-feeding, baby-sleep, strollers, car-seats, baby-carriers, diapering, nursery-gear, power-tools, hand-tools, storage-org, camping, hiking, fishing, hunting, water-sports, smart-home, wearables, audio-gear, edc-carry, truck-gear, detailing, cast-iron, meal-prep, fitness, home-gym, cleaning, organization

Return your result by calling the submit_guide tool. Field guidance: title is a specific, useful title (max 80 chars, include the topic keyword); excerpt is one punchy card sentence (max 160 chars); tldr is 2–3 plain-English skimmer sentences; keyTakeaways are 3–5 specific, actionable items; faqs are 3–5 question/answer pairs (answers 2–3 sentences); introduction is 2–3 sentences (first-person dad opening a real situation); each section has a clear, action-oriented heading and a 150–250 word body with paragraphs separated by \\n\\n; conclusion is 1–2 paragraphs with a clear next step (separated by \\n\\n if 2 paragraphs); heroImagePrompt is an editorial-photography hero prompt (specific real-world objects, natural daylight or warm indoor light, no people, no text, under 180 chars); each inlineImages.afterHeading MUST match one of your section headings; suggestedTags are 3–6 slugs from the controlled vocabulary above.`

  const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)
  let result
  try {
    result = await createStructured({
      system: systemBlocks,
      messages: [{ role: 'user', content: prompt }],
      tool: GUIDE_DRAFT_TOOL,
      maxTokens: 3800,
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
