import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { createStructured } from '@/lib/claude/structured'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

// 8000-token reviews can take 1-2 min under load; 90s was cutting it close.
export const maxDuration = 180

// The model returns the draft by calling this tool — its input_schema is the
// shape, so the SDK validates it instead of us regex-parsing JSON from text.
const DRAFT_TOOL: Anthropic.Tool = {
  name: 'submit_review',
  description: 'Return the finished product review draft.',
  input_schema: {
    type: 'object',
    properties: {
      title:        { type: 'string' },
      excerpt:      { type: 'string' },
      tldr:         { type: 'string' },
      keyTakeaways: { type: 'array', items: { type: 'string' } },
      bestFor:      { type: 'array', items: { type: 'string' } },
      notFor:       { type: 'array', items: { type: 'string' } },
      faqs:         { type: 'array', items: {
        type: 'object',
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
        required: ['question', 'answer'],
      } },
      subScores:    { type: 'object', properties: {
        quality: { type: 'integer' }, value: { type: 'integer' },
        ease: { type: 'integer' }, dailyUse: { type: 'integer' },
      }, required: ['quality', 'value', 'ease', 'dailyUse'] },
      wouldRebuy:   { type: 'boolean' },
      introduction: { type: 'string' },
      sections:     { type: 'array', items: {
        type: 'object',
        properties: { heading: { type: 'string' }, body: { type: 'string' } },
        required: ['heading', 'body'],
      } },
      verdict:      { type: 'string' },
      pros:         { type: 'array', items: { type: 'string' } },
      cons:         { type: 'array', items: { type: 'string' } },
      imagePrompt:  { type: 'string' },
      inlineImages: { type: 'array', items: {
        type: 'object',
        properties: {
          afterHeading: { type: 'string' }, prompt: { type: 'string' },
          altText: { type: 'string' }, caption: { type: 'string' },
        },
        required: ['afterHeading', 'prompt', 'altText', 'caption'],
      } },
      suggestedTags: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'title', 'excerpt', 'tldr', 'keyTakeaways', 'bestFor', 'notFor', 'faqs',
      'subScores', 'wouldRebuy', 'introduction', 'sections', 'verdict', 'pros',
      'cons', 'imagePrompt', 'inlineImages', 'suggestedTags',
    ],
  },
}

const DraftInput = z.object({
  productName:     z.string().min(2).max(120),
  category:        z.string().min(2).max(80),
  keyFeatures:     z.array(z.string()).max(15).default([]),
  targetAudience:  z.string().max(200).optional(),
  productSlug:     z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),
  // Catalog facts (optional) — ground the draft when a product is linked.
  brand:           z.string().max(120).optional(),
  specs:           z.array(z.object({ label: z.string().max(60), value: z.string().max(200) })).max(30).default([]),
  // Competitor products (optional) — author-selected, same category, other
  // brands. Their verified specs let the draft draw honest head-to-head contrasts.
  competitors:     z.array(z.object({
                     name:  z.string().max(120),
                     brand: z.string().max(120).optional(),
                     specs: z.array(z.object({ label: z.string().max(60), value: z.string().max(200) })).max(30).default([]),
                   })).max(4).default([]),
  // 'auto' lets Claude pick (2–3 images); a number forces exactly that many.
  imageSlots:      z.union([z.literal('auto'), z.number().int().min(0).max(6)]).default('auto'),
  // Experience fields — author-provided; drive tone/verdict alignment.
  // ratingHint is the author's gut-feel target for the overall (1-10). Claude
  // uses it to shape the four sub-scores so they average near this target.
  // The hint is NOT persisted — the saved rating is generated from the sub-scores.
  ratingHint:      z.number().int().min(1).max(10),
  testingDuration: z.enum(['<1wk', '1-4wks', '1-3mo', '3+mo', '6mo', '1yr', '2yr', '3yr', '5yr', 'custom']).optional(),
  testingSince:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  testingNote:     z.string().max(120).optional(),
  howYouUsedIt:    z.string().max(600).optional(),
  standoutMoment:  z.string().max(600).optional(),
  pricePaid:       z.number().int().min(0).optional(),
})

function inlineImagesInstruction(slots: number | 'auto'): string {
  if (slots === 0) {
    return 'INLINE IMAGES:\n- Do not include any inline images. Return an empty array for "inlineImages".'
  }
  if (slots === 'auto') {
    return `INLINE IMAGES:
- Suggest 2–3 inline image placements that would meaningfully improve the review. Each maps to a section heading you also generated above (use the exact heading text in "afterHeading").
- Prompt style: editorial product photography, warm/natural lighting, realistic setting, no people, no text. Under 180 chars.
- "altText" is the a11y description of the image (what a reader would describe if it were rendered). Keep under 120 chars.
- "caption" is a short sentence the reader sees under the image — human, editorial, not a re-statement of the alt text. Under 100 chars.`
  }
  return `INLINE IMAGES:
- Suggest exactly ${slots} inline image placement${slots === 1 ? '' : 's'} that would meaningfully improve the review. Each maps to a section heading you also generated above (use the exact heading text in "afterHeading").
- Prompt style: editorial product photography, warm/natural lighting, realistic setting, no people, no text. Under 180 chars.
- "altText" is the a11y description of the image (what a reader would describe if it were rendered). Keep under 120 chars.
- "caption" is a short sentence the reader sees under the image — human, editorial, not a re-statement of the alt text. Under 100 chars.`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success, remaining, reset } = await checkRateLimit(`draft:${user.id}`)
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. You can generate 10 drafts per hour.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = DraftInput.safeParse(body)
  if (!parsed.success) {
    console.error('review-draft validation failed:', parsed.error.flatten())
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { productName, category, keyFeatures, targetAudience, productSlug, brand, specs, competitors, imageSlots, ratingHint, testingDuration, testingSince, testingNote, howYouUsedIt, standoutMoment, pricePaid } = parsed.data

  const cleanSpecs = specs.filter((s) => s.label.trim() && s.value.trim())
  const specsBlock = cleanSpecs.length
    ? `\n\nPRODUCT SPECS (verified facts — weave the relevant ones in naturally; never invent or contradict these, and don't dump them all as a list):\n${cleanSpecs.map((s) => `- ${s.label}: ${s.value}`).join('\n')}`
    : ''

  // Competitor context — author-picked rivals in the same category. Their specs
  // let Claude draw real contrasts ("lighter than the X, but pricier"). Strict
  // rule: only contrast on the facts given; never fabricate a competitor claim.
  const cleanCompetitors = competitors
    .map((c) => ({ ...c, specs: c.specs.filter((s) => s.label.trim() && s.value.trim()) }))
    .filter((c) => c.name.trim())
  const competitorsBlock = cleanCompetitors.length
    ? `\n\nCOMPETITORS (the author is comparing against these — same category; could be rival brands or other models. Draw honest, specific head-to-head contrasts where it helps the reader decide; ONLY use the facts listed here, never invent a competitor's spec or claim):\n${cleanCompetitors.map((c) => {
        const head = c.brand ? `${c.brand} ${c.name}` : c.name
        const lines = c.specs.length ? c.specs.map((s) => `    • ${s.label}: ${s.value}`).join('\n') : '    • (no specs provided)'
        return `- ${head}:\n${lines}`
      }).join('\n')}`
    : ''

  const durationLabel: Record<string, string> = {
    '<1wk': 'less than 1 week', '1-4wks': '1–4 weeks', '1-3mo': '1–3 months', '3+mo': '3+ months',
    '6mo': '6+ months', '1yr': 'over a year', '2yr': 'over two years', '3yr': 'over three years', '5yr': 'over five years',
  }

  // For a 'custom' duration, prefer the explicit start date, then the free-text note.
  const durationText = testingDuration === 'custom'
    ? (testingSince ? `since ${testingSince}` : testingNote ?? null)
    : (testingDuration ? durationLabel[testingDuration] ?? testingDuration : null)

  const experienceLines = [
    `Author target rating: ${ratingHint}/10 — the four sub-scores you produce must average to roughly this value. Tone, verdict, pros/cons balance must all reflect this target.`,
    durationText ? `Testing duration: ${durationText}` : null,
    howYouUsedIt ? `How I used it: ${howYouUsedIt}` : null,
    standoutMoment ? `Standout moment: ${standoutMoment}` : null,
    pricePaid != null ? `Price paid: $${(pricePaid / 100).toFixed(2)}` : null,
  ].filter(Boolean).join('\n')

  const prompt = `Write a product review:

Product: ${productName}${brand ? `\nBrand: ${brand}` : ''}
Category: ${category}${keyFeatures.length ? `\nKey Features: ${keyFeatures.join(', ')}` : ''}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}${productSlug ? `\nProduct slug: ${productSlug}` : ''}${specsBlock}${competitorsBlock}

AUTHOR EXPERIENCE (ground truth — write the review as if you lived this):
${experienceLines}

STRUCTURE REQUIREMENTS:
- Introduction: 2–3 sentences that open with a real testing scenario (first-person dad)
- Sections: 3–5 sections, each 150–250 words covering different aspects (performance, design, value, family use, etc.)
- Separate paragraphs within each section with \\n\\n
- Verdict: 1–2 paragraphs with a clear buy/skip recommendation; if a product slug was provided, end the verdict with the third [[BUY:slug]] token
- Pros: 3–6 short, specific items (not vague — "12V battery lasted 4 hours" not "long battery")
- Cons: 2–4 honest, specific items — never skip the cons

CONTENT BLOCKS (required — these render as structured UI elements, not prose):
- tldr: 1–2 sentence verdict for skimmers. No jargon. Lead with the gut answer ("Solid mid-tier carrier at a fair price." / "Skip this — better options at the same price.").
- keyTakeaways: 3–5 specific, useful bullet points. Not a rehash of pros — highlight the most surprising or decision-relevant insights.
- bestFor: 3–4 specific buyer profiles who will love this (e.g. "Dads doing solo overnight feedings", "Budget-conscious families who need reliability")
- notFor: 2–3 specific situations or buyer types who should skip (be honest — vague "not for everyone" is not acceptable)
- faqs: 3–5 Q&A pairs covering the most common purchase questions. Answers 2–3 sentences each. Write questions the way a real dad searching Google would phrase them.
- subScores: four 1–10 integers that DEFEND a target overall of ${ratingHint}/10. They must average to ~${ratingHint}.0 (no 10s on a 6 review). One can be a clear weak spot. These four are the SINGLE SOURCE OF TRUTH for the overall rating — the displayed rating is computed as their average, so make them honest and consistent with the verdict tone. Fields:
  • quality   — build / formulation / materials
  • value     — worth the price paid
  • ease      — ease of use, setup, daily friction
  • dailyUse  — fits real life, holds up under normal dad-life conditions
- wouldRebuy: boolean. True only if a thoughtful dad would honestly buy this product again knowing what he knows now. Default to true for target ≥ 8; for 5–7 think carefully; for ≤ 4 default to false.

SEO: Include the product name naturally in the intro and at least one section heading.

${inlineImagesInstruction(imageSlots)}

TAGS: Pick 3–6 slugs from this controlled vocabulary that best describe this review. Be selective — only tag what genuinely applies.
Editorial (pick at most 1): top-pick, best-value, splurge, hidden-gem, boss-approved, mixed-verdict, buyer-beware, better-options, overhyped
Life Stage (pick relevant ones): pregnancy, newborn, infant, toddler, preschool, school-age, teen
Price: under-25, under-50, under-100, under-250, premium
Use Case: travel, daily, occasional, gift-idea, gear-haul
Topic: home-improvement, workshop, automotive, yard-work, kitchen-tools, outdoor-cooking, mental-health, mindfulness, self-help, faith, formula-feeding, baby-sleep, strollers, car-seats, baby-carriers, diapering, nursery-gear, power-tools, hand-tools, storage-org, camping, hiking, fishing, hunting, water-sports, smart-home, wearables, audio-gear, edc-carry, truck-gear, detailing, cast-iron, meal-prep, fitness, home-gym, cleaning, organization

Return your result by calling the submit_review tool. Field guidance: title is an SEO title including the product name (max 70 chars); excerpt is one punchy card sentence (max 160 chars); tldr is 1–2 skimmer sentences; section bodies are 150–250 words with paragraphs separated by \\n\\n; subScores are four 1–10 integers; imagePrompt is a product photography prompt (no people, no text, under 180 chars); each inlineImages.afterHeading MUST match one of your section headings; suggestedTags are 3–6 slugs from the controlled vocabulary above.`

  const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)
  let result
  try {
    result = await createStructured({
      system: systemBlocks,
      messages: [{ role: 'user', content: prompt }],
      tool: DRAFT_TOOL,
      // A full review (intro + 3-5 sections + verdict + pros/cons + FAQs +
      // takeaways + sub-scores + image prompts + tags) is large; 8000 keeps the
      // tool input from truncating. claude-sonnet-4-6 handles 8k easily.
      maxTokens: 8000,
      maxRetries: 4,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Claude API error (review-draft):', msg)
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

  // Truncation guard: if the model hit the token ceiling the tool input is cut
  // off and unsafe to use — say so plainly instead of returning a partial draft.
  if (result.stopReason === 'max_tokens') {
    console.error('review-draft hit max_tokens — output truncated')
    return NextResponse.json({
      error: 'The draft ran long and got cut off. Try again, or drop the inline image slots to 0–2 and regenerate.',
    }, { status: 502 })
  }

  const draft = result.data
  if (!draft) {
    return NextResponse.json({ error: 'AI returned an unexpected format — please try again.' }, { status: 502 })
  }

  // Extract the AI-suggested image prompt — return it so the form can pre-fill
  // the editable prompt field. Images are generated separately.
  const imagePrompt: string = (draft.imagePrompt as string)
    ?? `Photorealistic product photo of the ${productName} on a clean surface, natural lighting, no people`

  const suggestedTags = Array.isArray(draft.suggestedTags) ? draft.suggestedTags as string[] : []

  // Strip imagePrompt and suggestedTags from the draft payload — they're returned
  // alongside, not inside. The rating field is no longer accepted from the AI; the
  // overall is computed from the four sub-scores at the DB level.
  const { imagePrompt: _omit, rating: _claudeRating, suggestedTags: _tags, ...cleanDraft } = draft

  return NextResponse.json({ draft: cleanDraft, imagePrompt, suggestedTags, remaining })
}
