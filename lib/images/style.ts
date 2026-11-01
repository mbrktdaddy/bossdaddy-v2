// The house photographic style — ONE suffix for every editorial-lane image
// (hero + body figures on reviews, guides and collections), so the site reads
// as if one photographer shot it. The language models that plan images
// describe the SUBJECT only (lib/content/pipeline/images.ts); this is the only
// place lighting, lens and palette are written. Change it here, never in a
// prompt. The social / media-library lane does not get it — a quote card or a
// meme is not a documentary photograph.

export const HOUSE_STYLE_MARKER = 'Photographic style:'

export const HOUSE_STYLE =
  `${HOUSE_STYLE_MARKER} documentary editorial photography for a print magazine. ` +
  'Natural available light, soft and directional, true-to-life warm colour with a muted earthy palette and one warm accent. ' +
  'A 35mm lens at a slightly wide working distance, shallow but honest depth of field, the subject sharp. ' +
  'A lived-in real-world setting with everyday clutter left in, candid framing, matte finish. ' +
  'Not a studio product shot, not HDR, not neon, not an illustration or a 3D render, no stock-photo posing.'

/** Append the house style once; a prompt that already carries it is returned as-is. */
export function applyHouseStyle(prompt: string): string {
  const base = prompt.trim()
  if (base.includes(HOUSE_STYLE_MARKER)) return base
  return `${base}\n\n${HOUSE_STYLE}`
}

// The second sanctioned look: an editorial illustration instead of the
// documentary photograph. Table Duty / Watch Duty essays (and any guide the
// author flags) use it; the choice is a `look` that rides every editorial
// request. The rules (no brands, no text, no identifiable children, the people
// policy) are the same either way - only the style text and the framing words
// in the notes change.

export type ImageLook = 'photo' | 'illustration'
export const IMAGE_LOOKS: readonly ImageLook[] = ['photo', 'illustration']

export const ILLUSTRATION_STYLE_MARKER = 'Illustration style:'

export const ILLUSTRATION_STYLE =
  `${ILLUSTRATION_STYLE_MARKER} editorial spot illustration for the op-ed page of a print magazine. ` +
  'A flat, hand-drawn feel with confident ink linework and loose textured fills; a limited palette of warm off-white paper, near-black ink and one burnt-orange accent; generous negative space; the subject simplified to its telling shape. ' +
  'Not a cartoon, not clip art, not a 3D render, not a photograph, not a watercolour wash.'

/** Append the illustration style once; a prompt that already carries it is returned as-is. */
export function applyIllustrationStyle(prompt: string): string {
  const base = prompt.trim()
  if (base.includes(ILLUSTRATION_STYLE_MARKER)) return base
  return `${base}\n\n${ILLUSTRATION_STYLE}`
}

/** The look's style text, appended once: the house style for a photo, the illustration style for an illustration. */
export function applyLook(prompt: string, look: ImageLook = 'photo'): string {
  return look === 'illustration' ? applyIllustrationStyle(prompt) : applyHouseStyle(prompt)
}

// The crop note — told to the model when the stored file is centre-cropped after
// generation (heroes 16:10, portrait frames 4:5), so the subject lands in the band
// that survives the crop instead of being cut at an edge. Like the house style it
// is written HERE, never in a subject prompt; lib/images/openai.ts applies it
// after the house style and before the safety rules. Editorial lane only — a
// social card is not cropped.

export const CROP_NOTE_MARKER = 'Composition:'

const CROP_NOTES: Record<'16:10' | '4:5', string> = {
  '16:10':
    `${CROP_NOTE_MARKER} this frame is centre-cropped to 16:10 — keep the subject in the central band ` +
    'with breathing room on every side; nothing that matters near the top or bottom edges.',
  '4:5':
    `${CROP_NOTE_MARKER} this frame is centre-cropped to 4:5 from a taller portrait — keep the subject ` +
    'in the central band; nothing that matters near the top or bottom edges.',
}

export function cropNote(aspect: '16:10' | '4:5'): string {
  return CROP_NOTES[aspect]
}

/** Append the crop note once; a prompt that already carries it is returned as-is. */
export function applyCropNote(prompt: string, aspect: '16:10' | '4:5'): string {
  const base = prompt.trim()
  if (base.includes(CROP_NOTE_MARKER)) return base
  return `${base}\n\n${cropNote(aspect)}`
}

// The reference note — told to the model on the finalize pass, where the picked
// contact-sheet draft is attached as an image edit and the Publication tier
// re-renders it. The draft is the composition; the render is the finish. Written
// HERE like the other notes, and appended LAST (after the safety rules) so
// nothing in the house style or the rules reads as a request to recompose.

export const REFERENCE_NOTE_MARKER = 'Reference:'

export const REFERENCE_NOTE = `${REFERENCE_NOTE_MARKER} the attached image is the composition to keep — the same framing, subject placement, setting and moment. Render it as the finished photograph: sharper, cleaner light, true materials, anything malformed corrected. Add nothing that is not already in it.`

const ILLUSTRATION_REFERENCE_NOTE = `${REFERENCE_NOTE_MARKER} the attached image is the composition to keep — the same framing, subject placement, setting and moment. Render it as the finished illustration: cleaner line, flatter fills, anything malformed corrected. Add nothing that is not already in it.`

/** The reference note for a look: the photograph clause for a photo, the illustration clause for an illustration. */
export function referenceNote(look: ImageLook = 'photo'): string {
  return look === 'illustration' ? ILLUSTRATION_REFERENCE_NOTE : REFERENCE_NOTE
}

/** Append the reference note once; a prompt that already carries it is returned as-is. */
export function applyReferenceNote(prompt: string, look: ImageLook = 'photo'): string {
  const base = prompt.trim()
  if (base.includes(REFERENCE_NOTE_MARKER)) return base
  return `${base}\n\n${referenceNote(look)}`
}
