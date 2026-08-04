// Shared allowlist check for image endpoints (/api/og, /api/img). Only our own
// images may be fetched/transformed — Supabase storage public objects, our own
// site-origin static assets under /images, and our Printful product mockups.
// Never an arbitrary URL (no open proxy / SSRF).

// Printful hosts the mockups for OUR merch catalog (merch.image_url), so /gear
// cards need it to render a product photo instead of falling back to the text
// card. Already a trusted first-party image source elsewhere in the app:
// next.config.ts `images.remotePatterns` and the CSP `img-src` allowlist. Exact
// host prefix — not a suffix/substring match, which `evil.com/files.cdn.printful.com`
// style URLs would defeat.
const PRINTFUL_CDN = 'https://files.cdn.printful.com/'

export function isOwnImageUrl(url: string): boolean {
  const storage = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (storage && url.startsWith(`${storage}/storage/v1/object/public/`)) return true
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (site && url.startsWith(`${site}/images/`)) return true
  if (url.startsWith(PRINTFUL_CDN)) return true
  return false
}
