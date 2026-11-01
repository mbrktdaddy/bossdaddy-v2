import { z } from 'zod'
import {
  IMAGE_SHOTS,
  PROMPT_CHARS,
  doctrineBlock,
  isFigureAspect,
  isImageNeed,
  isImageShot,
  type FigureAspect,
  type ImageNeed,
  type ImageShot,
} from '../../images/doctrine'
import type { DraftInlineImage } from '../html'
import { InlineImageOutput } from '../schemas'
import { briefLabel } from './briefs'
import { runProse } from './section'
import type { ImagePlan, OutlinePart, RunState } from './types'

// Stage 5 — the photo editor's shot list, planned from the FINISHED prose. For
// each placement the model decides what the picture NEEDS: an AI photograph
// (scene / detail / hands) or something only the author can capture (`owned`: a
// screen, an app, a document, a specific product). An owned placement carries an
// `ask` instead of a prompt. Production data (2026-10) showed every vision-QA
// text failure came from a prompt that asked for a phone or dashboard screen,
// which cannot be drawn under the no-text rule. The rules the model follows are
// lib/images/doctrine.ts, shared with the prompt-assist route. Lighting, lens and
// palette are NOT written here: the house style is applied at generation time
// (lib/images/style.ts), so a prompt describes what is in the frame, not how it
// is lit.

// The shared InlineImageOutput leaves the photo-editor fields optional so the
// single-shot draft routes and stored drafts keep parsing. The planner has to
// decide every placement, so here they are required, and the JSON schema says
// so, because a model drops optional keys.
const PlannedImage = InlineImageOutput.required({ need: true, shot: true, aspect: true, prompt: true, ask: true })

export const ImagesOutput = z.object({
  heroPrompt: z.string().min(1).max(PROMPT_CHARS.max).describe(
    `The hero image: ONE paragraph of ${PROMPT_CHARS.min}–${PROMPT_CHARS.max} characters in five labelled clauses (SUBJECT, SETTING, MOMENT, FOCAL, EXCLUDE). A wide or medium shot composed in the central band, because it is cropped to 16:10. People only anonymously; no text, brands or logos; no lighting, lens or style words.`,
  ),
  heroShot: z.enum(IMAGE_SHOTS).describe('The hero shot type: wide or medium, never detail. Choose it so the inline images take different shots.'),
  inline: z.array(PlannedImage).max(6)
    .describe('Placements that genuinely help the reader; afterHeading must match a body heading exactly'),
})
export type ImagesModelOutput = z.infer<typeof ImagesOutput>

/** What validateImagePlan accepts: the model's output, or the older shape without the photo-editor fields. */
export interface ImagesModelInput {
  heroPrompt: string
  heroShot?: ImageShot
  inline: z.input<typeof InlineImageOutput>[]
}

export function imagesPrompt(run: RunState): string {
  const brief = run.brief
  const outline = run.outline!
  const count = outline.imageCount
  const kind = briefLabel(brief)
  const headings = outline.parts.filter((p) => p.kind === 'body').map((p) => p.heading)
  const essay = brief.contentType === 'guide' && (brief.pieceType === 'essay' || brief.inquiryMode)
  const facts = [
    `Title: ${outline.title}`,
    `Kind: ${kind}`,
    `Category: ${brief.category}`,
    essay ? 'An essay or discussion piece: each picture is an object or a place that carries the idea. Never a staged emotion, never a face.' : null,
    essay ? 'Rendered as editorial illustrations (see the illustration rule): each subject is a drawable idea.' : null,
    brief.contentType === 'review' ? 'A product review: the product is a specific make and model, so a picture of the product itself is an owned placement. AI scenes show the place and the use around it.' : null,
    count === 0
      ? 'The author wants NO inline images: return an empty inline array and only the hero.'
      : `Plan exactly ${count} inline image${count === 1 ? '' : 's'}; owned placements count toward that number.`,
  ].filter((line): line is string => !!line).map((line) => `- ${line}`).join('\n')

  return `You are the photo editor for this finished ${kind}. Read the prose, then plan its pictures: one hero and the inline images, each placed after the body heading whose prose it serves. For every picture decide whether an AI can photograph it or the author has to capture it himself.

THE PIECE
${facts}

BODY HEADINGS (afterHeading must be one of these, verbatim):
${headings.map((h) => `- ${h}`).join('\n')}

THE PROSE:
"""
${runProse(run)}
"""

${doctrineBlock({ people: 'anonymous', allowText: false, look: essay ? 'illustration' : 'photo' })}

HOW TO PLAN IT
1. Read each section before you choose. Set "need" from what its prose is about: scene, detail or hands when an AI can photograph it; owned when the picture depends on anything in the never-ask-for list above. An owned placement has an empty "prompt" and an "ask": one concrete line telling the author what to capture.
2. Choose "shot" across the whole piece, hero included, so the hero and the slots differ. The hero is wide or medium; heroShot is never detail.
3. Choose "aspect" for each inline image from its shot, using the aspect rule above. For an owned placement it is the shape the author should crop to: 4:5 for a phone screen, 3:2 for a laptop or a wide scene.
4. Pull the season, the time of day, the weather, the objects and the places from the prose. Never invent a setting the prose does not support.
5. Write the hero prompt and every AI prompt in the five-clause shape, 450–650 characters. 700 is a hard cap: a longer prompt fails the whole plan.
6. Spread the placements across different sections where the piece allows. For an owned placement, altText describes what the author's photo will show.`
}

/** The shape a placement takes when the model gave none: tall for hands, square for detail and overhead, else wide. */
function defaultAspect(need: ImageNeed, shot: ImageShot): FigureAspect {
  if (need === 'hands') return '4:5'
  if (need === 'detail' || shot === 'detail' || shot === 'overhead') return '1:1'
  return '3:2'
}

/**
 * Turn the model's plan into the stored one: drop placements that don't match a
 * real body heading, normalise the rest, clamp to the chosen count.
 *   - need defaults to scene, shot to medium, aspect to the shape the shot suggests;
 *   - an owned placement has no prompt and always an ask (fallback: "Your photo of: ", then the alt text);
 *   - an AI placement with no prompt has nothing to generate from and is dropped
 *     BEFORE the clamp, so a dropped one does not cost the author a slot;
 *   - the hero shot defaults to wide and is never a detail.
 */
export function validateImagePlan(model: ImagesModelInput, parts: OutlinePart[], count: number): ImagePlan {
  const headings = new Map(parts.filter((p) => p.kind === 'body').map((p) => [p.heading.trim().toLowerCase(), p.heading]))
  const inline: DraftInlineImage[] = []
  for (const img of model.inline) {
    const afterHeading = headings.get(img.afterHeading.trim().toLowerCase())
    if (!afterHeading) continue
    const need: ImageNeed = isImageNeed(img.need) ? img.need : 'scene'
    const shot: ImageShot = isImageShot(img.shot) ? img.shot : 'medium'
    const aspect: FigureAspect = isFigureAspect(img.aspect) ? img.aspect : defaultAspect(need, shot)
    const placement = { afterHeading, need, shot, aspect, altText: img.altText, caption: img.caption }
    if (need === 'owned') {
      inline.push({ ...placement, prompt: '', ask: img.ask?.trim() || `Your photo of: ${img.altText}` })
    } else if (img.prompt?.trim()) {
      inline.push({ ...placement, prompt: img.prompt.trim() })
    }
  }
  const heroShot: ImageShot = !isImageShot(model.heroShot) ? 'wide' : model.heroShot === 'detail' ? 'medium' : model.heroShot
  return { heroPrompt: model.heroPrompt.trim(), heroShot, inline: inline.slice(0, count) }
}
