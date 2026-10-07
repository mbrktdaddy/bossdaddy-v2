// The hosts next/image will load: a mirror of `images.remotePatterns` in
// next.config.ts. A product image_url on any other host throws at render (the
// Radar card, spec tables), so the product API refuses one, and the link import
// re-uploads a page's image through /api/media instead of saving its URL.
//
// Mirrored, not imported, so next.config.ts stays free of app modules;
// tests/unit/remote-image-hosts.test.ts fails if the two drift.

export const STATIC_IMAGE_HOSTS = [
  'images.unsplash.com',
  'm.media-amazon.com',
  'files.cdn.printful.com',
] as const

/** Our Supabase Storage host, derived exactly as next.config.ts derives it. */
export function supabaseImageHost(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : 'fsxbertkzcigvkdyqgep.supabase.co'
}

/** The host of an image URL, or null if it isn't an https URL. */
export function imageHost(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' ? u.hostname.toLowerCase() : null
  } catch {
    return null
  }
}

/** Whether next/image can render this URL on the site. */
export function isRenderableImageUrl(url: string): boolean {
  const host = imageHost(url)
  return !!host && (host === supabaseImageHost() || (STATIC_IMAGE_HOSTS as readonly string[]).includes(host))
}
