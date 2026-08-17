import sharp from 'sharp'

const MIN_DIMENSION = 400
const MAX_DIMENSION = 1600
const WEBP_QUALITY  = 82

export interface NormalizeResult {
  buffer: Buffer
  width:  number
  height: number
}

/**
 * Server-side image normalization: auto-rotate (EXIF), resize to fit within
 * MAX_DIMENSION, convert to WebP. Rejects if shortest edge < `minDimension`.
 *
 * `minDimension` defaults to 400 (editorial/product photos need print-grade
 * resolution). Pass 0 to disable the floor — DM attachments accept small
 * screenshots, memes, and thumbnails that would never qualify as content.
 */
export async function normalizeImage(
  input: Buffer,
  { minDimension = MIN_DIMENSION }: { minDimension?: number } = {},
): Promise<NormalizeResult> {
  const meta = await sharp(input).metadata()
  const shortEdge = Math.min(meta.width ?? 0, meta.height ?? 0)

  if (minDimension > 0 && shortEdge > 0 && shortEdge < minDimension) {
    throw Object.assign(
      new Error(`Image too small — minimum ${minDimension}px on shortest side (got ${shortEdge}px)`),
      { status: 400 },
    )
  }

  // ANIMATION IS DETECTED, NOT DECLARED. Sniffing `pages` from the metadata
  // covers animated GIF and animated WebP alike, and it can't be lied to by a
  // wrong Content-Type — which a caller passing an `animated: true` flag could.
  // Without this the pipeline reads frame one and silently ships a still: the
  // sender sees the GIF they picked, the recipient gets a frozen frame, and
  // nothing anywhere reports an error.
  const animated = (meta.pages ?? 1) > 1

  const pipeline = sharp(input, { animated })

  const { data, info } = await (
    // .rotate() applies EXIF orientation, which only stills carry — and on a
    // multi-page image it would rotate the frame STRIP rather than each frame.
    animated ? pipeline : pipeline.rotate()
  )
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true })

  return {
    buffer: data,
    width: info.width,
    // ⚠️ `info.height` ON AN ANIMATED IMAGE IS EVERY FRAME STACKED. Sharp models
    // animation as one tall vertical strip, so a 10-frame 300px GIF reports 3000.
    // Storing that lands in the <img> width/height attributes and reserves ten
    // times the space it needs, leaving a huge hole in the thread. `pageHeight`
    // is the single-frame height, which is what a renderer means by "height".
    height: animated ? (info.pageHeight ?? info.height) : info.height,
  }
}
