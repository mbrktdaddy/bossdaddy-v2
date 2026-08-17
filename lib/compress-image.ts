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
/**
 * Is this WebP animated? There is no browser API that answers this, so read the
 * container: an animated WebP is a VP8X extended file carrying an `ANIM` chunk
 * (global animation params) and one `ANMF` frame chunk per frame. Both live near
 * the front of the file, so a 4KB slice is plenty and nothing large is read.
 *
 * latin1 so each byte maps to one character — UTF-8 decoding would mangle the
 * binary either side of the chunk tags and could split one across a boundary.
 */
async function isAnimatedWebp(file: File): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer())
    const text = new TextDecoder('latin1').decode(head)
    return text.includes('ANIM') || text.includes('ANMF')
  } catch {
    // Unreadable slice — assume animated. Skipping compression costs bandwidth;
    // guessing "still" costs the animation, and only one of those is recoverable.
    return true
  }
}

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

  // ⚠️ ANIMATION CANNOT GO THROUGH CANVAS. `drawImage` paints exactly one frame,
  // so compressing a GIF here would hand the server a still and the recipient
  // would get a frozen image — with no error anywhere, because from the code's
  // point of view everything worked. Pass animated files through untouched and
  // let the server re-encode them (normalizeImage detects animation and keeps
  // it). They skip client compression entirely, which is why the server still
  // enforces the size cap.
  if (file.type === 'image/gif') return file
  if (file.type === 'image/webp' && await isAnimatedWebp(file)) return file

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
