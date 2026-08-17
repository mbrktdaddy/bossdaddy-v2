import 'server-only'

// Unfurling: turn a URL into a cached preview row, and read those rows back.
//
// EVERY function here needs the SERVICE-ROLE client, because `link_previews` has no
// RLS policies at all (migration 156). That is deliberate — `to authenticated using
// (true)` would let any member enumerate every URL shared in every private message
// on the site — so all access runs through server code that has already established
// who is allowed to see what.
//
// Callers must therefore never hand a preview to a member without first confirming
// they belong to the conversation the link was posted in. The thread page does that
// by only ever looking up URLs it found in messages RLS already let that member read.

import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeUrl } from './net-guard'
import { guardedFetch, MAX_HTML_BYTES, MAX_IMAGE_BYTES } from './fetch'
import { parseMetadata } from './parse'
import { normalizeImage } from '@/lib/images/normalize'
import { toStorageBody } from '@/lib/storage-body'
import type { PublicPreview } from './types'

/** Re-check a cached row after this long. Page titles change; not often. */
const OK_TTL_MS = 30 * 24 * 60 * 60 * 1000   // 30 days
/**
 * Failures are re-tried far sooner than successes are refreshed, but NOT on every
 * view — that's the whole reason 'failed' is a cached status. A site that was down
 * for an hour shouldn't be punished for a month, and a link that will never resolve
 * shouldn't cost an outbound request every time the thread is opened.
 */
const FAILED_TTL_MS = 6 * 60 * 60 * 1000     // 6 hours

/** Reused rather than adding a bucket: same privacy model, same mime allowlist (webp). */
const BUCKET = 'dm-media'
const IMAGE_PREFIX = 'link-previews'

// Declared in ./types so client components can import it without pulling this
// server-only module into the browser bundle.
export type { PublicPreview } from './types'

interface PreviewRow {
  id: string
  url: string
  status: string
  title: string | null
  description: string | null
  site_name: string | null
  image_path: string | null
  image_width: number | null
  image_height: number | null
  fetched_at: string
}

function toPublic(row: PreviewRow): PublicPreview | null {
  if (row.status !== 'ok') return null
  // A card with nothing in it is worse than no card — a bare host name and an empty
  // box reads as a broken image rather than as a link.
  if (!row.title && !row.description && !row.image_path) return null
  return {
    url:         row.url,
    title:       row.title,
    description: row.description,
    siteName:    row.site_name,
    imageSrc:    row.image_path ? `/api/link-preview/image/${row.id}` : null,
    imageWidth:  row.image_width,
    imageHeight: row.image_height,
  }
}

function isStale(row: PreviewRow): boolean {
  const age = Date.now() - new Date(row.fetched_at).getTime()
  return age > (row.status === 'ok' ? OK_TTL_MS : FAILED_TTL_MS)
}

/**
 * Cache-only read for a batch of URLs. Never fetches.
 *
 * Used by the thread's server render, which must not block on somebody else's
 * server: a slow third party would become a slow page load for a conversation that
 * has nothing to do with it. Misses come back absent and the client asks for them
 * afterwards.
 */
export async function readCachedPreviews(rawUrls: string[]): Promise<Map<string, PublicPreview>> {
  const normalized = new Set<string>()
  for (const raw of rawUrls) {
    const result = normalizeUrl(raw)
    if (result.ok) normalized.add(result.url)
  }
  if (normalized.size === 0) return new Map()

  const admin = createAdminClient()
  const { data } = await admin
    .from('link_previews')
    .select('id, url, status, title, description, site_name, image_path, image_width, image_height, fetched_at')
    .in('url', Array.from(normalized))

  const out = new Map<string, PublicPreview>()
  for (const row of (data ?? []) as PreviewRow[]) {
    const pub = toPublic(row)
    if (pub) out.set(row.url, pub)
  }
  return out
}

/**
 * Fetch and cache a preview, or return the cached one if it's still fresh.
 *
 * Returns null for anything that isn't worth showing — a blocked URL, a dead host,
 * a page with no metadata. The CALLER MUST NOT surface the reason: "blocked" tells
 * a prober that the address they aimed at was internal, which is precisely the
 * signal the guard exists to withhold. The reason is stored for us, not for them.
 */
export async function unfurl(rawUrl: string): Promise<PublicPreview | null> {
  const normalized = normalizeUrl(rawUrl)
  if (!normalized.ok) return null
  const url = normalized.url

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('link_previews')
    .select('id, url, status, title, description, site_name, image_path, image_width, image_height, fetched_at')
    .eq('url', url)
    .maybeSingle()

  const cached = existing as PreviewRow | null
  if (cached && !isStale(cached)) return toPublic(cached)

  const page = await guardedFetch(url, { maxBytes: MAX_HTML_BYTES, expect: 'html' })
  if (!page.ok) {
    await record(url, { status: 'failed', error: page.reason })
    return null
  }

  const meta = parseMetadata(page.data.body.toString('utf8'))

  // No image is a perfectly good preview; a failed image must not fail the card.
  let image: { path: string; width: number; height: number } | null = null
  if (meta.imageUrl) {
    // Resolved against the FINAL url, so a relative og:image on a redirected page
    // still points at the right host.
    let absolute: string | null = null
    try { absolute = new URL(meta.imageUrl, page.data.url).toString() } catch { absolute = null }
    if (absolute) image = await storeThumbnail(absolute)
  }

  if (!meta.title && !meta.description && !image) {
    await record(url, { status: 'failed', error: 'no-metadata' })
    return null
  }

  const row = await record(url, {
    status:       'ok',
    title:        meta.title,
    description:  meta.description,
    site_name:    meta.siteName,
    image_path:   image?.path ?? null,
    image_width:  image?.width ?? null,
    image_height: image?.height ?? null,
    error:        null,
  })
  return row ? toPublic(row) : null
}

/**
 * Fetch a thumbnail, re-encode it, and store it as ours.
 *
 * ⚠️ THE RE-ENCODE IS NOT AN OPTIMIZATION. Serving somebody else's bytes straight
 * through would carry whatever they sent — including a payload dressed as an image,
 * and any EXIF the file happens to hold. normalizeImage decodes it with sharp and
 * writes a fresh WebP, so what we store is provably an image and provably
 * metadata-free. `minDimension: 0` because a small favicon-ish og:image is still a
 * usable thumbnail.
 */
async function storeThumbnail(imageUrl: string): Promise<{ path: string; width: number; height: number } | null> {
  const fetched = await guardedFetch(imageUrl, { maxBytes: MAX_IMAGE_BYTES, expect: 'image' })
  if (!fetched.ok) return null

  try {
    const normalized = await normalizeImage(fetched.data.body, { minDimension: 0 })
    const path = `${IMAGE_PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`
    const { error } = await createAdminClient().storage
      .from(BUCKET)
      .upload(path, toStorageBody(normalized.buffer, 'image/webp'), {
        contentType: 'image/webp',
        upsert: false,
      })
    if (error) {
      console.error('link preview thumbnail upload failed:', error)
      return null
    }
    return { path, width: normalized.width, height: normalized.height }
  } catch (err) {
    // Not an image sharp can read, or a decode bomb it refused. Either way the card
    // is still worth showing without one.
    console.error('link preview thumbnail decode failed:', err)
    return null
  }
}

/** The columns `record` is allowed to write. `status` is required — see the upsert. */
interface RecordFields {
  status:        'ok' | 'failed'
  title?:        string | null
  description?:  string | null
  site_name?:    string | null
  image_path?:   string | null
  image_width?:  number | null
  image_height?: number | null
  error?:        string | null
}

/** Upsert the cache row. `url` is unique, so a race between two viewers collapses. */
async function record(
  url: string,
  fields: RecordFields,
): Promise<PreviewRow | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('link_previews')
    .upsert(
      { url, fetched_at: new Date().toISOString(), ...fields },
      { onConflict: 'url' },
    )
    .select('id, url, status, title, description, site_name, image_path, image_width, image_height, fetched_at')
    .maybeSingle()
  if (error) {
    console.error('link preview cache write failed:', error)
    return null
  }
  return data as PreviewRow | null
}

/** The storage path for a preview's thumbnail — for the image proxy route only. */
export async function thumbnailPathFor(previewId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('link_previews')
    .select('image_path')
    .eq('id', previewId)
    .maybeSingle()
  return (data as { image_path: string | null } | null)?.image_path ?? null
}
