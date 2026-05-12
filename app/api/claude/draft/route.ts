import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 90

const DraftInput = z.object({
  productName:     z.string().min(2).max(120),
  category:        z.string().min(2).max(80),
  keyFeatures:     z.array(z.string()).max(15).default([]),
  targetAudience:  z.string().max(200).optional(),
  productSlug:     z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),
  // 'auto' lets Claude pick (2–3 images); a number forces exactly that many.
  imageSlots:      z.union([z.literal('auto'), z.number().int().min(0).max(6)]).default('auto'),
  // Experience fields — author-provided; drive tone/verdict alignment.
  rating:          z.number().int().min(1).max(10),
  testingDuration: z.enum(['<1wk', '1-4wks', '1-3mo', '3+mo']).optional(),
  howYouUsedIt:    z.string().max(300).optional(),
  standoutMoment:  z.string().max(300).optional(),
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

  const { productName, category, keyFeatures, targetAudience, productSlug, imageSlots, rating, testingDuration, howYouUsedIt, standoutMoment, pricePaid } = parsed.data

  const durationLabel: Record<string, string> = {
    '<1wk': 'less than 1 week', '1-4wks': '1–4 weeks', '1-3mo': '1–3 months', '3+mo': '3+ months',
  }

  const experienceLines = [
    `Author rating: ${rating}/10 — IMPORTANT: the entire draft (tone, verdict, pros/cons balance, recommendation) must reflect this exact score. Do not adjust it.`,
    testingDuration ? `Testing duration: ${durationLabel[testingDuration] ?? testingDuration}` : null,
    howYouUsedIt ? `How I used it: ${howYouUsedIt}` : null,
    standoutMoment ? `Standout moment: ${standoutMoment}` : null,
    pricePaid != null ? `Price paid: $${(pricePaid / 100).toFixed(2)}` : null,
  ].filter(Boolean).join('\n')

  const prompt = `Write a product review:

Product: ${productName}
Category: ${category}${keyFeatures.length ? `\nKey Features: ${keyFeatures.join(', ')}` : ''}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}${productSlug ? `\nProduct slug: ${productSlug}` : ''}

AUTHOR EXPERIENCE (ground truth — write the review as if you lived this):
${experienceLines}

STRUCTURE REQUIREMENTS:
- Introduction: 2–3 sentences that open with a real testing scenario (first-person dad)
- Sections: 3–5 sections, each 150–250 words covering different aspects (performance, design, value, family use, etc.)
- Separate paragraphs within each section with \\n\\n
- Verdict: 1–2 paragraphs with a clear buy/skip recommendation; if a product slug was provided, end the verdict with the third [[BUY:slug]] token
- Pros: 3–6 short, specific items (not vague — "12V battery lasted 4 hours" not "long battery")
- Cons: 2–4 honest, specific items — never skip the cons
- Rating: output the author-provided rating (${rating}) exactly — do not adjust it

CONTENT BLOCKS (required — these render as structured UI elements, not prose):
- tldr: 1–2 sentence verdict for skimmers. No jargon. Lead with the gut answer ("Solid mid-tier carrier at a fair price." / "Skip this — better options at the same price.").
- keyTakeaways: 3–5 specific, useful bullet points. Not a rehash of pros — highlight the most surprising or decision-relevant insights.
- bestFor: 3–4 specific buyer profiles who will love this (e.g. "Dads doing solo overnight feedings", "Budget-conscious families who need reliability")
- notFor: 2–3 specific situations or buyer types who should skip (be honest — vague "not for everyone" is not acceptable)
- faqs: 3–5 Q&A pairs covering the most common purchase questions. Answers 2–3 sentences each. Write questions the way a real dad searching Google would phrase them.
- subScores: four 1–10 integers that DEFEND the overall rating of ${rating}. They must average roughly to the overall (no 10s on a 6 review). One can be a clear weak spot. Fields:
  • quality   — build / formulation / materials
  • value     — worth the price paid
  • ease      — ease of use, setup, daily friction
  • dailyUse  — fits real life, holds up under normal dad-life conditions
- wouldRebuy: boolean. True only if a thoughtful dad would honestly buy this product again knowing what he knows now. Default to true for ratings ≥ 8; for 5–7 think carefully; for ≤ 4 default to false.

SEO: Include the product name naturally in the intro and at least one section heading.

${inlineImagesInstruction(imageSlots)}

TAGS: Pick 3–6 slugs from this controlled vocabulary that best describe this review. Be selective — only tag what genuinely applies.
Editorial (pick at most 1): top-pick, best-value, splurge, hidden-gem, boss-approved, mixed-verdict, buyer-beware, better-options, overhyped
Life Stage (pick relevant ones): pregnancy, newborn, infant, toddler, preschool, school-age, teen
Price: under-25, under-50, under-100, under-250, premium
Use Case: travel, daily, occasional, gift-idea, gear-haul
Topic: home-improvement, workshop, automotive, yard-work, kitchen-tools, outdoor-cooking, mental-health, mindfulness, self-help, faith, formula-feeding, baby-sleep, strollers, car-seats, baby-carriers, diapering, nursery-gear, power-tools, hand-tools, storage-org, camping, hiking, fishing, hunting, water-sports, smart-home, wearables, audio-gear, edc-carry, truck-gear, detailing, cast-iron, meal-prep, fitness, home-gym, cleaning, organization

Return JSON with this exact shape:
{
  "title": "string (SEO title including product name, max 70 chars — e.g. 'DeWalt 20V Drill Review: Built for Real Dad Projects')",
  "excerpt": "string (one punchy sentence for the card — max 160 chars)",
  "tldr": "string (1–2 sentences, skimmer-friendly verdict)",
  "keyTakeaways": ["string (3–5 items, specific and useful)"],
  "bestFor": ["string (3–4 specific buyer profiles)"],
  "notFor": ["string (2–3 specific skip scenarios)"],
  "faqs": [{ "question": "string", "answer": "string (2–3 sentences)" }],
  "subScores": { "quality": number (1-10), "value": number (1-10), "ease": number (1-10), "dailyUse": number (1-10) },
  "wouldRebuy": boolean,
  "introduction": "string (2–3 sentences, first-person dad opening with a real use case)",
  "sections": [
    { "heading": "string (clear heading)", "body": "string (150–250 words, paragraphs separated by \\n\\n)" }
  ],
  "verdict": "string (1–2 paragraphs, clear recommendation, separated by \\n\\n if 2 paragraphs)",
  "rating": number (1–10, decimals ok),
  "pros": ["string"],
  "cons": ["string"],
  "imagePrompt": "string (DALL-E 3 prompt: the product in a realistic setting, natural or warm lighting, clean composition, no people, no text, under 180 chars, style: editorial product photography)",
  "inlineImages": [
    { "afterHeading": "string (must match one of the section headings above)", "prompt": "string", "altText": "string", "caption": "string" }
  ],
  "suggestedTags": ["string (3–6 slugs from the controlled vocabulary above)"]
}`

  const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)
  const claudeResult = await getClaudeClient().messages.create({
    model: MODEL,
    max_tokens: 3800,
    system: systemBlocks,
    messages: [{ role: 'user', content: prompt }],
  }).catch((err: unknown) => {
    console.error('Claude API error (review-draft):', err)
    return { _error: err instanceof Error ? err.message : String(err) } as const
  })

  if ('_error' in claudeResult) {
    const msg = claudeResult._error
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

  const text = claudeResult.content.find((b) => b.type === 'text')?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'AI returned an unexpected format — please try again.' }, { status: 502 })
  }

  let draft: Record<string, unknown>
  try {
    draft = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: 'AI returned malformed content — please try again.' }, { status: 502 })
  }

  // Extract the AI-suggested image prompt — return it so the form can pre-fill
  // the editable prompt field. Images are generated separately.
  const imagePrompt: string = (draft.imagePrompt as string)
    ?? `Photorealistic product photo of the ${productName} on a clean surface, natural lighting, no people`

  const suggestedTags = Array.isArray(draft.suggestedTags) ? draft.suggestedTags as string[] : []

  // Strip imagePrompt and suggestedTags from draft payload; override rating with author value.
  const { imagePrompt: _omit, rating: _claudeRating, suggestedTags: _tags, ...draftWithoutExtras } = draft
  const cleanDraft = { ...draftWithoutExtras, rating }

  return NextResponse.json({ draft: cleanDraft, imagePrompt, suggestedTags, remaining })
}
