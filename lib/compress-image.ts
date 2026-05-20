/**
 * Client-side image normalization using the browser Canvas API.
 *
 * Resizes to a max dimension and re-encodes as WebP. Runs entirely in the
 * browser — nothing is sent to the server until after compression. Typical
 * savings: a 12MP phone photo (~8 MB) → ~150–300 KB at quality 0.82.
 *
 * EXIF metadata (including GPS coords) is stripped naturally by canvas re-encoding.
 * EXIF orientation is auto-applied before the canvas draw in modern browsers
 * (Chrome 81+, Safari 14+, Firefox 26+), so rotated phone shots land correctly.
 *
 * Safe fallback: if anything goes wrong the original file is returned unchanged.
 *
 * iOS Safari auto-converts HEIC → JPEG before the file reaches JS, so HEIC
 * files from iPhone are handled transparently.
 *
 * @throws if minPx is set and the image's shortest edge is below it
 */
export async function compressImage(
  file: File,
  {
    maxPx   = 1600,   // longest edge — covers any hero or card size
    quality = 0.82,   // WebP quality 0–1; matches server-side re-encode target
    minPx   = 0,      // reject if shortest edge is below this (0 = no check)
  }: { maxPx?: number; quality?: number; minPx?: number } = {},
): Promise<File> {
  // Already optimal: small WebP that doesn't need resizing
  if (file.type === 'image/webp' && file.size < 200_000) return file

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { width, height } = img

      if (minPx > 0 && Math.min(width, height) < minPx) {
        reject(new Error(`Image too small — minimum ${minPx}px on shortest side (got ${Math.min(width, height)}px)`))
        return
      }

      let w = width, h = height
      if (w > maxPx || h > maxPx) {
        if (w >= h) { h = Math.round((h * maxPx) / w); w = maxPx }
        else        { w = Math.round((w * maxPx) / h); h = maxPx }
      }

      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h

      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }

      ctx.drawImage(img, 0, 0, w, h)

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
            type: 'image/webp',
            lastModified: Date.now(),
          }))
        },
        'image/webp',
        quality,
      )
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
