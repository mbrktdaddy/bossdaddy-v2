// The photo-editor doctrine shared by every model that WRITES an image prompt:
// the pipeline `images` stage (lib/content/pipeline/images.ts) and the
// prompt-assist route (app/api/images/prompt). It says what a prompt is for,
// what it must contain, and what no AI image on this site may be asked to show.
//
// Lighting, lens and palette are NOT here — that is lib/images/style.ts, applied
// in code at generation time so the whole site reads as one photographer. The
// safety clauses the image model receives are lib/images/safety.ts; this file
// is the upstream rule set that keeps the prompt writers from asking for
// things those clauses will reject (the 2026-10 data: every text failure was a
// prompt that asked for a screen).
//
// Client-safe: plain strings and pure functions only.

import type { PeoplePolicy } from './safety'

/** What a slot needs. The first three are AI photographs; `owned` is a thing only a real capture can show. */
export const IMAGE_NEEDS = ['scene', 'detail', 'hands', 'owned'] as const
export type ImageNeed = (typeof IMAGE_NEEDS)[number]

/** The shot vocabulary a photo editor assigns across one piece. */
export const IMAGE_SHOTS = ['wide', 'medium', 'detail', 'overhead', 'pov'] as const
export type ImageShot = (typeof IMAGE_SHOTS)[number]

/** Body-figure aspects. Heroes are always 16:10 and are not chosen here. */
export const FIGURE_ASPECTS = ['3:2', '1:1', '4:5'] as const
export type FigureAspect = (typeof FIGURE_ASPECTS)[number]

export const PROMPT_CHARS = { min: 400, max: 700 } as const

export function isImageNeed(v: unknown): v is ImageNeed {
  return typeof v === 'string' && (IMAGE_NEEDS as readonly string[]).includes(v)
}
export function isImageShot(v: unknown): v is ImageShot {
  return typeof v === 'string' && (IMAGE_SHOTS as readonly string[]).includes(v)
}
export function isFigureAspect(v: unknown): v is FigureAspect {
  return typeof v === 'string' && (FIGURE_ASPECTS as readonly string[]).includes(v)
}

/**
 * Things an AI image on this site is never asked to show. A subject that needs
 * one of these is an `owned` need: the author captures it. Screens are the
 * big one — a login page, a settings menu, a dashboard readout cannot exist
 * without text, so the no-text rule and the prompt fight and the slot fails.
 */
export const UNRENDERABLES: readonly string[] = [
  'a phone, tablet, laptop, TV or dashboard SCREEN with anything showing on it',
  'an app, a website, a menu, a form, a sign-in page, a map',
  'a document, receipt, label, sign, chart, diagram or logo',
  'a specific make or model of anything, a brand, packaging',
  'a real place that has to be recognisable',
]

/** How people may appear without a face. The planner picks from this bank, never invents a face. */
export const ANONYMOUS_PHRASES: readonly string[] = [
  'hands at work, cropped at the wrists or forearms',
  'a figure from behind, walking away or facing the task',
  'over the shoulder, the face out of frame',
  'a silhouette against a window, a garage door or a dusk sky',
  'a child from behind, or from the shoulders down',
  'two pairs of boots on a porch step',
]

export const SHOT_GUIDE: Readonly<Record<ImageShot, string>> = {
  wide: 'the whole setting; the subject small; the room, yard or road tells the story',
  medium: 'a figure or object at conversational distance with the context still visible',
  detail: 'one object or texture filling the frame, the background a soft blur',
  overhead: 'straight down onto a table, bench, floor, tailgate or counter',
  pov: "first person: the viewer's own hands or boots at the bottom edge of the frame",
}

export const ASPECT_GUIDE: Readonly<Record<FigureAspect, string>> = {
  '3:2': 'wide and medium scenes',
  '1:1': 'overhead and detail shots; a square reads large on a phone',
  '4:5': 'a tall subject, hands at work, a doorway, a standing figure; the biggest image a phone can show',
}

/** The five-clause prompt shape every AI prompt follows. */
export const PROMPT_STRUCTURE =
  `Write each AI prompt as ONE paragraph of ${PROMPT_CHARS.min}–${PROMPT_CHARS.max} characters made of five labelled clauses: ` +
  'SUBJECT — what fills the frame, in concrete nouns; a generic, unbranded version of a category object (a cooler, a stroller, a drill) is welcome. ' +
  'SETTING — where it is, the season, the time of day, the weather, and two or three real details of the place taken from the piece. ' +
  'MOMENT — what is happening and what just happened; any people anonymous. ' +
  'FOCAL — the one thing that is sharp and nearest the viewer. ' +
  'EXCLUDE — what must not appear: always text, logos, brands and faces, plus whatever this setting would tempt (a screen on the dash, a label on the jar). ' +
  'Never write lighting, lens, film stock, colour grading or style words — the house style supplies those.'

export const HERO_COMPOSITION_RULE =
  'The hero is generated at 3:2 and cropped to 16:10: keep the subject in the central band with breathing room on every side, and put nothing that matters near the top or bottom edges. Heroes are wide or medium shots, never a detail.'

export const VARIETY_RULE =
  'Across one piece no two images share a shot type when it can be helped. If there are two or more inline images, at least one is a detail, overhead or hands shot. The season and time of day stay consistent within a piece unless the prose moves them.'

export const ESSAY_RULE =
  'For an essay or discussion piece the subject is an object or a place that carries the idea — an empty chair at a kitchen table, a porch at dusk, a folded jersey — never a staged emotion and never a face.'

export const OWNED_RULE =
  'A need that depends on an unrenderable is `owned`: leave the prompt empty and write `ask` as one concrete line telling the author exactly what to capture, in the second person, naming the thing ' +
  '("Screenshot of the OnStar sign-in screen with your account details hidden", "Your photo of the latch on the cooler lid"). Owned slots count toward the image count.'

/** The people rule as prompt text, by policy. */
export function peopleRule(policy: PeoplePolicy): string {
  if (policy === 'none') return 'No people at all: no hands, no figures, no body parts.'
  if (policy === 'allowed') {
    return 'People may appear with faces, but never an identifiable child; prefer one person doing something over a posed group.'
  }
  return `People appear only anonymously — pick from: ${ANONYMOUS_PHRASES.join('; ')}. Never describe a face. Never an identifiable child.`
}

/** The text rule as prompt text. */
export function textRule(allowText: boolean): string {
  if (!allowText) return 'No text of any kind: no lettering, numbers, signage, labels or watermarks; nothing in frame that would carry writing.'
  return 'If text is wanted, put the exact words in double quotes, at most four words, plain English, on one surface only; nothing else in frame carries lettering.'
}

/**
 * The full rule block a prompt-writing model receives. One source for the
 * planner and the assist so they never disagree about what is allowed.
 */
export function doctrineBlock(opts: { people: PeoplePolicy; allowText: boolean }): string {
  return [
    'RULES FOR EVERY IMAGE:',
    `- Never ask for: ${UNRENDERABLES.join('; ')}.`,
    `- ${OWNED_RULE}`,
    `- ${peopleRule(opts.people)}`,
    `- ${textRule(opts.allowText)}`,
    '- No logos, brands, packaging or a specific make or model; a generic unbranded category object is fine and often the right subject.',
    `- ${PROMPT_STRUCTURE}`,
    `- Shot types: ${IMAGE_SHOTS.map((s) => `${s} = ${SHOT_GUIDE[s]}`).join('; ')}.`,
    `- Aspect (inline figures only; phone readers first): ${FIGURE_ASPECTS.map((a) => `${a} for ${ASPECT_GUIDE[a]}`).join('; ')}.`,
    `- ${VARIETY_RULE}`,
    `- ${HERO_COMPOSITION_RULE}`,
    `- ${ESSAY_RULE}`,
    '- altText is what a reader would see described, under 120 characters, no "Image of". caption is one editorial sentence under the image that adds something the alt does not, under 100 characters.',
  ].join('\n')
}
