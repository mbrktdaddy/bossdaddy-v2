import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { buildBossDaddySystemMessagesWithInfo } from '@/lib/voiceProfile'
import { aiGenerateObjectWithMeta, failedCallMeta } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { fetchTagVocabulary, tagSlugList } from '@/lib/claude/tag-vocab'
import { ReviewDraftOutput, type ReviewDraft } from '@/lib/content/schemas'
import { PROMPT_VERSION, dataBlock, inlineImagesInstruction, specLines, validateSuggestedTags } from '@/lib/content/prompts'
import { logGeneration } from '@/lib/content/generations'
import { sanitizeSpecs } from '@/lib/content/specs'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

// 8000-token reviews can take 1-2 min under load; 90s was cutting it close.
// 300s = Vercel's current per-function ceiling. Raised from 180 because measured
// long-form generations run 57–125s on the 5-generation models and a single slow
// call plus the retries below already exceeded 180 in testing
// (`npm run ai:ab-content`, 2026-07-27). 180 was safe only while Sonnet 4.6 was fast.
export const maxDuration = 300

const EFFORT = 'high' as const
// Below the 1.0 default: a fact-heavy review against a strict banlist ("every
// claim has specifics") is where slip/hallucination hurts most.
const TEMPERATURE = 0.8

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
  // 'auto' lets the model pick (2–3 images); a number forces exactly that many.
  imageSlots:      z.union([z.literal('auto'), z.number().int().min(0).max(6)]).default('auto'),
  // Experience fields — author-provided; drive tone/verdict alignment.
  // ratingHint is the author's gut-feel target for the overall (1-10). The model
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

  // Specs are untrusted text (scraped from product pages) headed into a prompt:
  // sanitized, then fenced as DATA so nothing inside reads as an instruction.
  const cleanSpecs = sanitizeSpecs(specs)
  const specsBlock = cleanSpecs.length
    ? `\n\n${dataBlock('PRODUCT SPECS — verified catalog facts; weave the relevant ones in naturally, never invent or contradict them, and don\'t dump them all as a list', specLines(cleanSpecs))}`
    : ''

  // Competitor context — author-picked rivals in the same category. Their specs
  // let the model draw real contrasts ("lighter than the X, but pricier"). Strict
  // rule: only contrast on the facts given; never fabricate a competitor claim.
  const cleanCompetitors = competitors
    .map((c) => ({ name: c.name.trim(), brand: c.brand?.trim() || undefined, specs: sanitizeSpecs(c.specs) }))
    .filter((c) => c.name)
  const competitorsBlock = cleanCompetitors.length
    ? `\n\n${dataBlock(
        'COMPETITORS — same category, author-chosen; draw honest, specific head-to-head contrasts where it helps the reader decide, using ONLY the facts listed, never an invented spec or claim',
        cleanCompetitors.map((c) => {
          const head = c.brand ? `${c.brand} ${c.name}` : c.name
          const lines = c.specs.length ? c.specs.map((s) => `    • ${s.label}: ${s.value}`).join('\n') : '    • (no specs provided)'
          return `- ${head}:\n${lines}`
        }).join('\n'),
      )}`
    : ''

  const durationLabel: Record<string, string> = {
    '<1wk': 'less than 1 week', '1-4wks': '1–4 weeks', '1-3mo': '1–3 months', '3+mo': '3+ months',
    '6mo': '6+ months', '1yr': 'over a year', '2yr': 'over two years', '3yr': 'over three years', '5yr': 'over five years',
  }

  // For a 'custom' duration, prefer the explicit start date, then the free-text note.
  const durationText = testingDuration === 'custom'
    ? (testingSince ? `since ${testingSince}` : testingNote ?? null)
    : (testingDuration ? durationLabel[testingDuration] ?? testingDuration : null)

  const hasExperience = !!(durationText || howYouUsedIt || standoutMoment)
  const experienceLines = [
    `Author target rating: ${ratingHint}/10 — the four sub-scores you produce must average to roughly this value. Tone, verdict, pros/cons balance must all reflect this target.`,
    durationText ? `Testing duration: ${durationText}` : null,
    howYouUsedIt ? `How I used it: ${howYouUsedIt}` : null,
    standoutMoment ? `Standout moment: ${standoutMoment}` : null,
    pricePaid != null ? `Price paid: $${(pricePaid / 100).toFixed(2)}` : null,
  ].filter(Boolean).join('\n')

  // DB-driven tag vocabulary (killed the hardcoded slug list that used to drift).
  const tagVocab = await fetchTagVocabulary(supabase)

  // The exact model tested (mig 159), from the catalog: readers search by it.
  const { data: linkedProduct } = productSlug
    ? await supabase.from('products').select('model_number').eq('slug', productSlug).maybeSingle()
    : { data: null }
  const modelNumber = linkedProduct?.model_number ?? null

  const prompt = `Write a product review:

Product: ${productName}${brand ? `\nBrand: ${brand}` : ''}${modelNumber ? `\nModel number: ${modelNumber}` : ''}
Category: ${category}${keyFeatures.length ? `\nKey Features: ${keyFeatures.join(', ')}` : ''}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}${productSlug ? `\nProduct slug: ${productSlug}` : ''}${specsBlock}${competitorsBlock}

AUTHOR EXPERIENCE (ground truth — the ONLY firsthand experience you may claim; write from these notes and never add a usage detail, duration, test result or family reaction that isn't in them):
${experienceLines}

STRUCTURE REQUIREMENTS:
- Introduction: 2–3 sentences. ${hasExperience
    ? 'Open with a real moment from the author experience notes above (first-person dad).'
    : 'The notes carry no testing story, so open with the decision a dad is facing when he looks at this product — do NOT invent a testing scenario.'}
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
- subScores: four 1–10 integers that DEFEND a target overall of ${ratingHint}/10. They must average to ~${ratingHint}.0 (no 10s on a 6 review). One can be a clear weak spot. These four are the SINGLE SOURCE OF TRUTH for the overall rating — the displayed rating is computed as their average, so make them honest and consistent with the verdict tone.
- wouldRebuy: boolean. True only if a thoughtful dad would honestly buy this product again knowing what he knows now. Default to true for target ≥ 8; for 5–7 think carefully; for ≤ 4 default to false.

SEO: Include the product name naturally in the intro and at least one section heading.

${inlineImagesInstruction(imageSlots, 'review')}

TAGS: Pick 3–6 slugs from this controlled vocabulary that best describe this review. Be selective — only tag what genuinely applies.
Editorial (pick at most 1): ${tagSlugList(tagVocab, 'editorial')}
Life Stage (pick relevant ones): ${tagSlugList(tagVocab, 'life-stage')}
Price: ${tagSlugList(tagVocab, 'price')}
Use Case: ${tagSlugList(tagVocab, 'use-case')}
Topic: ${tagSlugList(tagVocab, 'topic')}

Each output field's description tells you its shape and length target — follow them. Each inlineImages.afterHeading MUST match one of your section headings exactly.`

  const { messages: systemMessages, info: voice } = await buildBossDaddySystemMessagesWithInfo(supabase, user.id)

  // Everything the author asked for, minus the system prompt (that's PROMPT_VERSION).
  const generationInput = {
    productName, category, keyFeatures, targetAudience, productSlug, brand,
    specs: cleanSpecs, competitors: cleanCompetitors, imageSlots, ratingHint,
    testingDuration, testingSince, testingNote, howYouUsedIt, standoutMoment, pricePaid,
    prompt,
  }

  const startedAt = Date.now()
  let draft: ReviewDraft
  let generationId: string | null = null
  let costUsd: number | null = null
  try {
    const { object, meta } = await aiGenerateObjectWithMeta<ReviewDraft>({
      bucket: 'content',
      tag: 'review-draft',
      schema: ReviewDraftOutput,
      system: systemMessages,
      messages: [{ role: 'user', content: prompt }],
      // 12000, up from 8000. Sonnet 5 tokenizes ~30% heavier than 4.6 for the same
      // prose, and adaptive thinking (on by default from the 5 generation) shares
      // this budget with the answer text — measured at 57% of output on one config.
      // Observed peak was 7496, i.e. 94% of the old ceiling. Kept under 16000, above
      // which non-streaming generateObject risks an HTTP timeout.
      maxOutputTokens: 12000,
      // Long-form brand copy: reasoning depth pinned rather than left to the
      // provider default, and deliberately NOT xhigh — see lib/ai/client.ts.
      effort: EFFORT,
      temperature: TEMPERATURE,
      maxRetries: 4,
      promptVersion: PROMPT_VERSION,
    })
    draft = object
    costUsd = meta.costUsd
    generationId = await logGeneration(supabase, {
      userId: user.id, contentType: 'review', stage: 'draft', status: 'done',
      meta, effort: EFFORT, temperature: TEMPERATURE, input: generationInput, output: draft,
    })
  } catch (err: unknown) {
    const c = classifyClaudeError(err)
    console.error('review-draft generation error:', c.kind, '-', c.detail)
    await logGeneration(supabase, {
      userId: user.id, contentType: 'review', stage: 'draft',
      status: c.kind === 'truncated' ? 'truncated' : 'failed',
      meta: failedCallMeta('content', startedAt, c.kind),
      effort: EFFORT, temperature: TEMPERATURE, input: generationInput,
    })
    // Truncation keeps its bespoke message (the output ran past the token
    // ceiling and is unsafe to use — steer the author to drop image slots).
    if (c.kind === 'truncated') {
      return NextResponse.json({
        error: 'The draft ran long and got cut off. Try again, or drop the inline image slots to 0–2 and regenerate.',
      }, { status: 502 })
    }
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }

  // The hero prompt is returned beside the draft so the form can pre-fill the
  // editable prompt field. Images are generated separately.
  const imagePrompt = draft.imagePrompt
    || `Photorealistic product photo of the ${productName} on a clean surface, natural lighting, no people`

  // Only slugs that exist in the live controlled vocabulary reach the picker.
  const suggestedTags = await validateSuggestedTags(supabase, draft.suggestedTags)

  // imagePrompt and suggestedTags travel alongside, not inside, the draft.
  const { imagePrompt: _omit, suggestedTags: _tags, ...cleanDraft } = draft

  return NextResponse.json({
    draft: cleanDraft,
    imagePrompt,
    suggestedTags,
    remaining,
    generationId,
    promptVersion: PROMPT_VERSION,
    costUsd,
    voice,
  })
}
