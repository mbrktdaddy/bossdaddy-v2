import { z } from 'zod'
import { ASPECT_GUIDE, FIGURE_ASPECTS, IMAGE_NEEDS, IMAGE_SHOTS, PROMPT_CHARS, SHOT_GUIDE } from '../images/doctrine'

// Zod output schemas for every content generation. Until 2026-10-23 the routes
// passed `jsonSchema()` with no `validate`, and in that case the AI SDK validates
// NOTHING (provider-utils `safeValidateTypes` returns success when `validate` is
// null) — every "max 70 chars" lived only in prompt prose.
//
// Hard limits here are the DB/save limits (title 120, excerpt 200, …), not the
// editorial targets (70 / 160). A hard limit the model trips throws
// NoObjectGeneratedError and loses a two-minute generation; the editorial
// targets stay in the field descriptions and become critic findings (Phase 1).
// `.describe()` text is forwarded to the model as the JSON-schema description,
// which is where field guidance belongs rather than in the prompt body.

export const FaqOutput = z.object({
  question: z.string().min(1).max(300).describe('Phrased the way a real dad would type it into Google'),
  answer:   z.string().min(1).max(1200).describe('2–3 sentences'),
})

export const SectionOutput = z.object({
  heading: z.string().min(1).max(200),
  body:    z.string().min(1).describe('Paragraphs separated by a blank line (\\n\\n)'),
})

// One image placement: the pipeline's photo-editor stage (lib/content/pipeline/
// images.ts) plans it, and the single-shot draft routes still emit it. The
// photo-editor fields (`need`, `shot`, `aspect`, `ask`) are optional here so
// older callers and stored drafts keep parsing; the pipeline's own schema marks
// them required, and `validateImagePlan` normalises whatever comes back.
// `prompt` may be empty because an `owned` placement carries an `ask` instead.
// Field order is the decision order: need, then shot and aspect, then the prompt.
export const InlineImageOutput = z.object({
  afterHeading: z.string().min(1).max(200).describe('MUST exactly match one of your section headings'),
  need:         z.enum(IMAGE_NEEDS).optional().describe(
    'What this placement needs. scene, detail or hands = an AI photograph. owned = something only a real capture can show (a screen, an app, a document, a map, a chart, a specific product) that the author must photograph or screenshot himself.',
  ),
  shot:         z.enum(IMAGE_SHOTS).optional().describe(
    `Shot type: ${IMAGE_SHOTS.map((s) => `${s} = ${SHOT_GUIDE[s]}`).join('; ')}. Vary it across the piece.`,
  ),
  aspect:       z.enum(FIGURE_ASPECTS).optional().describe(
    `Figure shape, phone readers first: ${FIGURE_ASPECTS.map((a) => `${a} for ${ASPECT_GUIDE[a]}`).join('; ')}`,
  ),
  prompt:       z.string().max(PROMPT_CHARS.max).default('').describe(
    `For scene, detail and hands: ONE paragraph of ${PROMPT_CHARS.min}–${PROMPT_CHARS.max} characters in five labelled clauses (SUBJECT, SETTING, MOMENT, FOCAL, EXCLUDE), no lighting, lens or style words. Empty string for owned.`,
  ),
  ask:          z.string().max(200).default('').describe(
    'For owned only: one concrete second-person line naming exactly what to capture, e.g. "Screenshot of the sign-in screen with your account details hidden". Empty string otherwise.',
  ),
  altText:      z.string().min(1).max(300).describe('Accessible description of what would be visible; aim for under 120 chars'),
  caption:      z.string().max(300).describe('Short editorial sentence shown under the image; aim for under 100 chars'),
})

export const SubScoresOutput = z.object({
  quality:  z.number().int().min(1).max(10).describe('Build / formulation / materials'),
  value:    z.number().int().min(1).max(10).describe('Worth the price paid'),
  ease:     z.number().int().min(1).max(10).describe('Ease of use, setup, daily friction'),
  dailyUse: z.number().int().min(1).max(10).describe('Fits real life; holds up under normal dad-life conditions'),
})

const title   = (hint: string) => z.string().min(1).max(120).describe(hint)
const excerpt = z.string().min(1).max(200).describe('One punchy card sentence; aim for under 160 chars')
const tags    = z.array(z.string().min(1).max(80)).max(10).describe('3–6 slugs from the controlled vocabulary in the prompt')
const takeaways = z.array(z.string().min(1).max(400)).max(8)

export const ReviewDraftOutput = z.object({
  title:        title('SEO title including the product name; aim for under 70 chars'),
  excerpt,
  tldr:         z.string().min(1).max(600).describe('1–2 sentence verdict for skimmers; lead with the gut answer'),
  keyTakeaways: takeaways.describe('3–5 decision-relevant insights, not a rehash of the pros'),
  bestFor:      z.array(z.string().min(1).max(300)).max(6).describe('3–4 specific buyer profiles'),
  notFor:       z.array(z.string().min(1).max(300)).max(6).describe('2–3 specific situations or buyers who should skip'),
  faqs:         z.array(FaqOutput).max(8).describe('3–5 pairs'),
  subScores:    SubScoresOutput,
  wouldRebuy:   z.boolean(),
  introduction: z.string().min(1),
  sections:     z.array(SectionOutput).min(1).max(10),
  verdict:      z.string().min(1).describe('1–2 paragraphs with a clear buy/skip call; paragraphs separated by \\n\\n'),
  pros:         z.array(z.string().min(1).max(300)).min(1).max(8).describe('3–6 short, specific items'),
  cons:         z.array(z.string().min(1).max(300)).min(1).max(8).describe('2–4 honest, specific items — never empty'),
  imagePrompt:  z.string().min(1).max(400).describe('Hero product-photography prompt, no people, no text; aim for under 180 chars'),
  inlineImages: z.array(InlineImageOutput).max(6),
  suggestedTags: tags,
})
export type ReviewDraft = z.infer<typeof ReviewDraftOutput>

export type GuidePieceType = 'essay' | 'howto' | 'guide'

const guideBase = {
  title:           title('Specific, useful title including the topic keyword; aim for under 80 chars'),
  excerpt,
  introduction:    z.string().min(1),
  sections:        z.array(SectionOutput).min(1).max(12),
  conclusion:      z.string().min(1).describe('Paragraphs separated by \\n\\n'),
  heroImagePrompt: z.string().min(1).max(400).describe('Editorial-photography hero prompt: real-world objects, natural or warm indoor light, no people, no text; aim for under 180 chars'),
  inlineImages:    z.array(InlineImageOutput).max(6),
  suggestedTags:   tags,
}

const guideBlocks = {
  tldr:         z.string().min(1).max(600).describe('2–3 plain-English skimmer sentences; lead with the main takeaway'),
  keyTakeaways: takeaways.describe('3–5 specific items'),
  faqs:         z.array(FaqOutput).max(8).describe('3–5 pairs'),
}

/**
 * Per piece type so essays and how-tos aren't forced to emit blocks that would
 * break their voice (and burn tokens the wizard then discards).
 */
export function guideDraftOutput(pieceType: GuidePieceType) {
  if (pieceType === 'essay') return z.object(guideBase)
  if (pieceType === 'howto') return z.object({ ...guideBase, tldr: guideBlocks.tldr, keyTakeaways: guideBlocks.keyTakeaways })
  return z.object({ ...guideBase, ...guideBlocks })
}
export type GuideDraft = z.infer<ReturnType<typeof guideDraftOutput>>

// ── Refines (whole-document; Phase 2 adds the section patch) ─────────────────

export const ReviewRefineOutput = z.object({
  title:        title('Updated title only if the instructions require it, otherwise the original'),
  excerpt:      excerpt.describe('Updated only if needed, otherwise the original'),
  tldr:         z.string().max(600).optional(),
  keyTakeaways: takeaways.optional(),
  bestFor:      z.array(z.string().max(300)).max(6).optional(),
  notFor:       z.array(z.string().max(300)).max(6).optional(),
  faqs:         z.array(FaqOutput).max(8).optional(),
  introduction: z.string().min(1),
  sections:     z.array(SectionOutput).min(1).max(10),
  verdict:      z.string().min(1),
  pros:         z.array(z.string().max(300)).max(8),
  cons:         z.array(z.string().max(300)).max(8),
})
export type ReviewRefine = z.infer<typeof ReviewRefineOutput>

export const GuideRefineOutput = z.object({
  title:        title('Updated title only if the instructions require it, otherwise the original'),
  excerpt:      excerpt.describe('Updated only if needed, otherwise the original'),
  tldr:         z.string().max(600).optional(),
  keyTakeaways: takeaways.optional(),
  faqs:         z.array(FaqOutput).max(8).optional(),
  introduction: z.string().min(1),
  sections:     z.array(SectionOutput).min(1).max(12),
  conclusion:   z.string().min(1),
})
export type GuideRefine = z.infer<typeof GuideRefineOutput>
