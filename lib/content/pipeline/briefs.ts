import { z } from 'zod'
import { sanitizeSpecs } from '../specs'
import { dataBlock, specLines } from '../prompts'
import type { Brief, GuideBrief, ReviewBrief } from './types'

// The wizard's inputs, validated once at run creation. The shapes mirror the
// old single-call routes so the wizards' forms didn't have to change.

const Spec = z.object({ label: z.string().max(60), value: z.string().max(200) })
const ImageSlots = z.union([z.literal('auto'), z.number().int().min(0).max(6)]).default('auto')

export const ReviewBriefInput = z.object({
  contentType:     z.literal('review'),
  productName:     z.string().min(2).max(120),
  category:        z.string().min(2).max(80),
  keyFeatures:     z.array(z.string().max(200)).max(15).default([]),
  targetAudience:  z.string().max(200).optional(),
  productSlug:     z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),
  brand:           z.string().max(120).optional(),
  modelNumber:     z.string().max(80).optional(),
  specs:           z.array(Spec).max(30).default([]),
  competitors:     z.array(z.object({
                     name:  z.string().max(120),
                     brand: z.string().max(120).optional(),
                     specs: z.array(Spec).max(30).default([]),
                   })).max(4).default([]),
  imageSlots:      ImageSlots,
  ratingHint:      z.number().int().min(1).max(10),
  testingDuration: z.enum(['<1wk', '1-4wks', '1-3mo', '3+mo', '6mo', '1yr', '2yr', '3yr', '5yr', 'custom']).optional(),
  testingSince:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  testingNote:     z.string().max(120).optional(),
  howYouUsedIt:    z.string().max(600).optional(),
  standoutMoment:  z.string().max(600).optional(),
  pricePaid:       z.number().int().min(0).optional(),
})

export const GuideBriefInput = z.object({
  contentType:    z.literal('guide'),
  topic:          z.string().min(4).max(150),
  category:       z.string().min(2).max(80),
  pieceType:      z.enum(['essay', 'howto', 'guide']).default('guide'),
  keyPoints:      z.array(z.string().max(300)).max(15).default([]),
  context:        z.string().max(6000).optional(),
  targetAudience: z.string().max(200).optional(),
  productSlugs:   z.array(z.string().regex(/^[a-z0-9-]+$/).max(80)).max(15).default([]),
  imageSlots:     ImageSlots,
  inquiryMode:    z.boolean(),
})

export const BriefInput = z.discriminatedUnion('contentType', [ReviewBriefInput, GuideBriefInput])

/** Normalise a validated brief: sanitized specs, no product links on inquiry pieces. */
export function normalizeBrief(b: z.infer<typeof BriefInput>): Brief {
  if (b.contentType === 'review') {
    return {
      ...b,
      specs: sanitizeSpecs(b.specs),
      competitors: b.competitors
        .map((c) => ({ name: c.name.trim(), brand: c.brand?.trim() || undefined, specs: sanitizeSpecs(c.specs) }))
        .filter((c) => c.name),
    }
  }
  return { ...b, context: b.context?.trim() || undefined, productSlugs: b.inquiryMode ? [] : b.productSlugs }
}

const DURATION_LABEL: Record<string, string> = {
  '<1wk': 'less than 1 week', '1-4wks': '1–4 weeks', '1-3mo': '1–3 months', '3+mo': '3+ months',
  '6mo': '6+ months', '1yr': 'over a year', '2yr': 'over two years', '3yr': 'over three years', '5yr': 'over five years',
}

/** "guide" / "personal essay" / "product review" — for prompts and the UI. */
export function briefLabel(brief: Brief): string {
  if (brief.contentType === 'review') return 'product review'
  if (brief.inquiryMode) {
    return brief.pieceType === 'essay' ? 'personal essay' : brief.pieceType === 'howto' ? 'short discussion piece' : 'long-form discussion piece'
  }
  return brief.pieceType === 'essay' ? 'personal essay' : brief.pieceType === 'howto' ? 'how-to guide' : 'guide'
}

/** The piece's subject line for prompts. */
export function briefSubject(brief: Brief): string {
  return brief.contentType === 'review' ? brief.productName : brief.topic
}

/**
 * Every firsthand fact the author supplied, as short lines. This list is the
 * grounding contract: the outline distributes these across parts, each part is
 * written from its share, and the critic flags firsthand claims outside them.
 */
export function briefFacts(brief: Brief): string[] {
  if (brief.contentType === 'review') return reviewFacts(brief)
  return guideFacts(brief)
}

function reviewFacts(b: ReviewBrief): string[] {
  const duration = b.testingDuration === 'custom'
    ? (b.testingSince ? `since ${b.testingSince}` : b.testingNote ?? null)
    : (b.testingDuration ? DURATION_LABEL[b.testingDuration] ?? b.testingDuration : null)
  return [
    duration ? `Testing duration: ${duration}` : null,
    b.howYouUsedIt ? `How I used it: ${b.howYouUsedIt}` : null,
    b.standoutMoment ? `Standout moment: ${b.standoutMoment}` : null,
    b.pricePaid != null ? `Price paid: $${(b.pricePaid / 100).toFixed(2)}` : null,
  ].filter((x): x is string => !!x)
}

function guideFacts(b: GuideBrief): string[] {
  const facts: string[] = []
  if (b.context) {
    // The brief is free text; split it into sentences so the outline can hand
    // specific lines to specific parts rather than the whole blob to every part.
    for (const s of b.context.split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)) {
      const t = s.trim()
      if (t) facts.push(t)
    }
  }
  return facts
}

/** Does the brief carry ANY firsthand material? Drives the no-invented-scenario rule. */
export function hasFirsthand(brief: Brief): boolean {
  return briefFacts(brief).length > 0
}

/** The untrusted-data blocks (specs, competitors) fenced for a prompt; '' if none. */
export function briefDataBlocks(brief: Brief): string {
  if (brief.contentType !== 'review') return ''
  const out: string[] = []
  const specs = specLines(brief.specs)
  if (specs) {
    out.push(dataBlock('PRODUCT SPECS — verified catalog facts; weave the relevant ones in naturally, never invent or contradict them, never dump them as a list', specs))
  }
  if (brief.competitors.length) {
    out.push(dataBlock(
      'COMPETITORS — same category, author-chosen; contrast ONLY on the facts listed, never an invented spec or claim',
      brief.competitors.map((c) => {
        const head = c.brand ? `${c.brand} ${c.name}` : c.name
        const lines = c.specs.length ? c.specs.map((s) => `    • ${s.label}: ${s.value}`).join('\n') : '    • (no specs provided)'
        return `- ${head}:\n${lines}`
      }).join('\n'),
    ))
  }
  return out.join('\n\n')
}

/** The fixed facts of the piece (not firsthand) — product/topic lines for prompts. */
export function briefHeaderLines(brief: Brief): string {
  if (brief.contentType === 'review') {
    return [
      `Product: ${brief.productName}`,
      brief.brand ? `Brand: ${brief.brand}` : null,
      brief.modelNumber ? `Model number: ${brief.modelNumber}` : null,
      `Category: ${brief.category}`,
      brief.keyFeatures.length ? `Key features: ${brief.keyFeatures.join(', ')}` : null,
      brief.targetAudience ? `Target audience: ${brief.targetAudience}` : null,
      `Author's target rating: ${brief.ratingHint}/10 — tone, verdict and the pros/cons balance must all reflect this.`,
    ].filter(Boolean).join('\n')
  }
  return [
    `Topic: ${brief.topic}`,
    `Category: ${brief.category}`,
    brief.keyPoints.length ? `Key points: ${brief.keyPoints.join(', ')}` : null,
    brief.targetAudience ? `Target audience: ${brief.targetAudience}` : null,
  ].filter(Boolean).join('\n')
}

/** Slugs that must appear as [[BUY:slug]] tokens somewhere in the piece. */
export function briefProductSlugs(brief: Brief): string[] {
  if (brief.contentType === 'review') return brief.productSlug ? [brief.productSlug] : []
  return brief.inquiryMode ? [] : brief.productSlugs
}
