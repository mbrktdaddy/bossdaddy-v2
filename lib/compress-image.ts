/**
 * Client-side image compression using the browser Canvas API.
 *
 * Resizes to a max dimension and re-encodes as JPEG. Runs entirely in the
 * browser — nothing is sent to the server until after compression. Typical
 * savings: a 12MP phone photo (~8 MB) → ~150–300 KB at quality 0.85.
 *
 * Safe fallback: if anything goes wrong the original file is returned unchanged.
 *
 * iOS Safari auto-converts HEIC → JPEG before the file reaches JS, so HEIC
 * files from iPhone are handled transparently.
 */
export async function compressImage(
  file: File,
  {
    maxPx   = 1920,   // longest edge in pixels — more than enough for any card/hero
    quality = 0.85,   // JPEG quality 0–1; 0.85 keeps visible quality while halving size
  }: { maxPx?: number; quality?: number } = {},
): Promise<File> {
  // Skip files that are already small — no point re-encoding
  if (file.size < 200_000) return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height * maxPx) / width)
          width  = maxPx
        } else {
          width  = Math.round((width * maxPx) / height)
          height = maxPx
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          const outName = file.name.replace(/\.[^.]+$/, '.jpg')
          resolve(new File([blob], outName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          }))
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
