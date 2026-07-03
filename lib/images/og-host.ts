// Shared allowlist check for image endpoints (/api/og, /api/img). Only our own
// images may be fetched/transformed — Supabase storage public objects and our
// own site-origin static assets under /images. Never an arbitrary URL (no open
// proxy / SSRF).
export function isOwnImageUrl(url: string): boolean {
  const storage = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (storage && url.startsWith(`${storage}/storage/v1/object/public/`)) return true
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (site && url.startsWith(`${site}/images/`)) return true
  return false
}
