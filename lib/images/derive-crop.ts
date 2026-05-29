/**
 * Fetch an existing image URL and wrap it as a File so it can be fed back into
 * ImageCropper for apply-time / derived cropping (existing library assets and
 * AI-generated images). The cropped result is uploaded as a NEW media asset by
 * the caller — the source asset is never mutated.
 *
 * ImageCropper turns this File into an object URL before drawing to canvas, so
 * the eventual canvas export is not CORS-tainted even though the source is a
 * remote Supabase Storage URL.
 */
export async function fetchAssetAsFile(url: string): Promise<File> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`)
  const blob = await res.blob()
  const name = url.split('/').pop()?.split('?')[0] || 'image'
  return new File([blob], name, { type: blob.type || 'image/webp' })
}
