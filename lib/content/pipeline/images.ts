import { z } from 'zod'
import { InlineImageOutput } from '../schemas'
import { briefLabel } from './briefs'
import { runProse } from './section'
import type { ImagePlan, OutlinePart, RunState } from './types'

// Stage 5 — image placements from the FINISHED prose. The model supplies the
// subject; the house style is applied at generation time (Phase 3,
// lib/images/style.ts), so prompts here describe what is in the frame, not how
// it is lit.

export const ImagesOutput = z.object({
  heroPrompt: z.string().min(1).max(400)
    .describe('The hero image subject: real-world objects, setting and moment that represent the piece; people only anonymously (hands, from behind, face out of frame); no text, no brand names or logos; aim under 180 chars'),
  inline: z.array(InlineImageOutput).max(6)
    .describe('Placements that genuinely help the reader; afterHeading must match a body heading exactly'),
})
export type ImagesModelOutput = z.infer<typeof ImagesOutput>

export function imagesPrompt(run: RunState): string {
  const brief = run.brief
  const count = run.outline!.imageCount
  const headings = run.outline!.parts.filter((p) => p.kind === 'body').map((p) => p.heading)
  return `Plan the images for this finished ${briefLabel(brief)}. ${count === 0
    ? 'The author wants NO inline images: return an empty inline array and only the hero.'
    : `Suggest exactly ${count} inline placement${count === 1 ? '' : 's'}.`}

Title: ${run.outline!.title}

BODY HEADINGS (afterHeading must be one of these, verbatim):
${headings.map((h) => `- ${h}`).join('\n')}

THE PIECE:
"""
${runProse(run)}
"""

RULES:
- Describe the SUBJECT of each image — the objects, the setting, the moment — in under 180 chars. Do not describe lighting, lens or style; the house style is applied separately.
- People may appear only anonymously: hands at work, a figure from behind, a face out of frame. Never describe a face or an identifiable child.
- No text in the image, no brand names, logos or packaging, no recognisable real-world products (editorial scene, not a product replica).
- altText is what a reader would see described (under 120 chars); caption is one editorial sentence under the image, not a restatement of the alt (under 100 chars).
- Each inline image sits after the heading whose prose it illustrates.`
}

/** Drop placements that don't match a real body heading; clamp to the chosen count. */
export function validateImagePlan(model: ImagesModelOutput, parts: OutlinePart[], count: number): ImagePlan {
  const headings = new Map(parts.filter((p) => p.kind === 'body').map((p) => [p.heading.trim().toLowerCase(), p.heading]))
  const inline = model.inline
    .map((img) => {
      const real = headings.get(img.afterHeading.trim().toLowerCase())
      return real ? { ...img, afterHeading: real } : null
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .slice(0, count)
  return { heroPrompt: model.heroPrompt, inline }
}
