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
