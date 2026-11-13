import { z } from 'zod'
import {
  IMAGE_SHOTS,
  PROMPT_CHARS,
  SETTING_FAMILIES,
  SETTING_GUIDE,
  atmosphereLine,
  doctrineBlock,
  isFigureAspect,
  isImageNeed,
  isImageShot,
  pickAtmosphere,
  type Atmosphere,
  type FigureAspect,
  type ImageNeed,
  type ImageShot,
} from '../../images/doctrine'
import { defaultPeopleForLook } from '../../images/safety'
import type { ImageLook } from '../../images/style'
import type { DraftInlineImage } from '../html'
import { InlineImageOutput } from '../schemas'
import { briefLabel } from './briefs'
import { runProse } from './section'
import type { ImagePlan, OutlinePart, RunState } from './types'

// Stage 5 — the photo editor's shot list, planned from the FINISHED prose. For
// each placement the model decides what the picture NEEDS: an AI picture
// (scene / detail / hands) or something only the author can capture (`owned`: a
// screen, an app, a document, a specific product). An owned placement carries an
// `ask` instead of a prompt. Production data (2026-10) showed every vision-QA
// text failure came from a prompt that asked for a phone or dashboard screen,
// which cannot be drawn under the no-text rule.
//
// 2026-11-13 — the topic sets the world. The plan opens with `world`: where
// this subject is actually seen, decided before any picture, so a research
// piece lands in a market street and a courthouse plaza instead of the kitchen
// table the old essay examples kept producing. Every picture names its
// `setting` so a piece cannot live in one room, and the run gets a random
// season / hour / weather suggestion (`pickAtmosphere`) for when the prose is
// silent. The rules the model follows are lib/images/doctrine.ts, shared with
// the prompt-assist route. Lighting, lens and palette are NOT written here: the
// house style is applied at generation time (lib/images/style.ts), so a prompt
// describes what is in the frame, not how it is lit.

const SETTING_DESCRIPTION =
  `Where this picture is set — one of: ${SETTING_FAMILIES.map((s) => `${s} = ${SETTING_GUIDE[s]}`).join('; ')}. ` +
  'Chosen from the piece\'s world; no two pictures share one when it can be helped, and at most one is "home" unless the piece is about the home.'

// The shared InlineImageOutput leaves the photo-editor fields optional so the
// single-shot draft routes and stored drafts keep parsing. The planner has to
// decide every placement, so here they are required, and the JSON schema says
// so, because a model drops optional keys. `setting` is planner-only: it shapes
// the choice and is not stored on the slot.
const PlannedImage = InlineImageOutput
  .required({ need: true, shot: true, aspect: true, prompt: true, ask: true })
  .extend({ setting: z.enum(SETTING_FAMILIES).describe(SETTING_DESCRIPTION) })

export const ImagesOutput = z.object({
  world: z.string().min(1).max(400).describe(
    "The piece's visual world, decided before any picture: one or two sentences naming the real places, objects and people where THIS topic is actually seen, taken from the subject and the prose. The site is for men who are fathers — that is the reader, not the setting: a kitchen, a nursery or a porch belongs here only when the piece is set there.",
  ),
  heroPrompt: z.string().min(1).max(PROMPT_CHARS.max).describe(
    `The hero image: ONE paragraph of ${PROMPT_CHARS.min}–${PROMPT_CHARS.max} characters in five labelled clauses (SUBJECT, SETTING, MOMENT, FOCAL, EXCLUDE), set in the world above. The widest view of the piece, composed in the central band, because it is cropped to 16:10. People as the people rule allows; no readable text, brands or logos; no lighting, lens or style words.`,
  ),
  heroShot: z.enum(IMAGE_SHOTS).describe('The hero shot type: wide, medium, through or aerial, or an overhead when the subject is a surface — never detail. Choose it so the inline images take different shots.'),
  heroSetting: z.enum(SETTING_FAMILIES).describe(SETTING_DESCRIPTION),
  inline: z.array(PlannedImage).max(6)
    .describe('Placements that genuinely help the reader; afterHeading must match a body heading exactly'),
})
export type ImagesModelOutput = z.infer<typeof ImagesOutput>

/** What validateImagePlan accepts: the model's output, or the older shape without the photo-editor fields. */
export interface ImagesModelInput {
  world?: string
  heroPrompt: string
  heroShot?: ImageShot
  heroSetting?: string
  inline: (z.input<typeof InlineImageOutput> & { setting?: string })[]
}

export interface ImagesPromptOptions {
  /** The season, hour and weather suggested when the prose is silent; drawn at random unless a test pins it. */
  atmosphere?: Atmosphere
}

export function imagesPrompt(run: RunState, opts: ImagesPromptOptions = {}): string {
  const brief = run.brief
  const outline = run.outline!
  const count = outline.imageCount
  const kind = briefLabel(brief)
  const headings = outline.parts.filter((p) => p.kind === 'body').map((p) => p.heading)
  const essay = brief.contentType === 'guide' && (brief.pieceType === 'essay' || brief.inquiryMode)
  // The illustration look follows the workspace's own default (inquiry mode):
  // a personal essay outside Table / Watch Duty is a photograph unless the
  // author flips the Look knob, so its prompts must not assume drawn faces.
  const look: ImageLook = brief.contentType === 'guide' && brief.inquiryMode ? 'illustration' : 'photo'
  const people = defaultPeopleForLook(look)
  const atmosphere = opts.atmosphere ?? pickAtmosphere()
  const facts = [
    `Title: ${outline.title}`,
    `Kind: ${kind}`,
    `Category: ${brief.category}`,
    'The pictures are of the TOPIC. Decide "world" first — the real places, objects and people where this subject is actually seen — and plan every picture inside it. The site is for men who are fathers: that is the reader, not the setting.',
    essay ? "An essay or discussion piece: each picture carries the idea through a real place or object from the topic's world (the essay rule below) — never a staged emotion, never a stock metaphor." : null,
    look === 'illustration' ? 'Rendered as editorial illustrations (the illustration rule below): each subject is a drawable idea, and drawn figures may carry simple faces.' : null,
    brief.contentType === 'review' ? 'A product review: the product is a specific make and model, so a picture of the product itself is an owned placement. AI scenes show the place and the use around it.' : null,
    atmosphereLine(atmosphere),
    count === 0
      ? 'The author wants NO inline images: return an empty inline array and only the hero.'
      : `Plan exactly ${count} inline image${count === 1 ? '' : 's'}; owned placements count toward that number.`,
  ].filter((line): line is string => !!line).map((line) => `- ${line}`).join('\n')

  return `You are the photo editor for this finished ${kind}. Read the prose, then plan its pictures: one hero and the inline images, each placed after the body heading whose prose it serves. For every picture decide whether an AI can make it or the author has to capture it himself.

THE PIECE
${facts}

BODY HEADINGS (afterHeading must be one of these, verbatim):
${headings.map((h) => `- ${h}`).join('\n')}

THE PROSE:
"""
${runProse(run)}
"""

${doctrineBlock({ people, allowText: false, look })}

HOW TO PLAN IT
1. Decide "world" before anything else: where is this subject actually seen? Name the real places, the objects and the people of that world in one or two sentences, from the subject and the prose. Then every picture — hero included — is set somewhere in it.
2. Read each section before you choose. Set "need" from what its prose is about: scene, detail or hands when an AI can make it; owned when the picture depends on anything in the never-ask-for list above. An owned placement has an empty "prompt" and an "ask": one concrete line telling the author what to capture.
3. Choose "setting" and "shot" across the whole piece, hero included, so no two pictures share a setting or a shot when it can be helped, and at most one picture is at home unless the piece is about the home. The hero is wide, medium, through or aerial (an overhead when the subject is a surface); heroShot is never detail.
4. Choose "aspect" for each inline image from its shot, using the aspect rule above. For an owned placement it is the shape the author should crop to: 4:5 for a phone screen, 3:2 for a laptop or a wide scene.
5. Take the places, objects and any season, hour or weather the prose gives. Where the prose is silent, choose from the topic's world — never from a default home — and use the atmosphere suggested above. Never invent a fact about the piece; a place of the right KIND is not an invention.
6. Write the hero prompt and every AI prompt in the five-clause shape, 450–650 characters. 700 is a hard cap: a longer prompt fails the whole plan.
7. Spread the placements across different sections where the piece allows. For an owned placement, altText describes what the author's photo will show.`
}

/** The shape a placement takes when the model gave none: tall for hands and low shots, square for detail and overhead, else wide. */
function defaultAspect(need: ImageNeed, shot: ImageShot): FigureAspect {
  if (need === 'hands' || shot === 'low') return '4:5'
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
 *   - the hero shot defaults to wide and is never a detail;
 *   - the world is kept when the model gave one (it reads back in the generations row).
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
  const world = model.world?.trim()
  return { heroPrompt: model.heroPrompt.trim(), heroShot, inline: inline.slice(0, count), ...(world ? { world } : {}) }
}
