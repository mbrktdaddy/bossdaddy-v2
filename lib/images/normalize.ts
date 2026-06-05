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

  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true })

  return { buffer: data, width: info.width, height: info.height }
}
