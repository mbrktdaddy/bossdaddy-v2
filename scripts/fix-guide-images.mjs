// Reconcile broken guide image references after the WebP backfill.
//
// For every guide image reference — the hero `guides.image_url` AND every inline
// <img src> embedded in `guides.content` — verify the file still exists in
// Supabase Storage. If it doesn't (because the .png/.jpg was converted to .webp
// and/or moved buckets, but the DB URL was never rewritten), locate the real
// file by matching its basename across all buckets (preferring a .webp sibling
// in the same bucket) and rewrite the stored URL to point at it.
//
// Read-only by default. Use --apply to write the fixes.
//
// Usage:
//   node --env-file=.env.local scripts/fix-guide-images.mjs           # dry-run
//   node --env-file=.env.local scripts/fix-guide-images.mjs --apply   # write fixes

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const APPLY = process.argv.includes('--apply')

// Buckets that can hold guide imagery, current + legacy.
const BUCKETS = ['guide-images', 'media', 'article-images', 'review-images']

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const log = (...a) => console.log(...a)
const PREFIX = `${SUPABASE_URL}/storage/v1/object/public/`

const baseNoExt = (name) => name.replace(/\.[a-z0-9]+$/i, '')

// ── Build a Storage index ────────────────────────────────────────────────────
// existsByBucket: bucket -> Set(filename)
// byBase:         basename-without-ext -> [{ bucket, name }]
async function buildIndex() {
  const existsByBucket = new Map()
  const byBase = new Map()

  for (const bucket of BUCKETS) {
    const names = new Set()
    let offset = 0
    const limit = 1000
    // Listing the bucket may fail if it doesn't exist — treat as empty.
    while (true) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list('', { limit, offset, sortBy: { column: 'name', order: 'asc' } })
      if (error) {
        log(`  (bucket "${bucket}" not listable: ${error.message})`)
        break
      }
      if (!data || data.length === 0) break
      for (const f of data) {
        if (!f.name) continue
        names.add(f.name)
        const key = baseNoExt(f.name).toLowerCase()
        if (!byBase.has(key)) byBase.set(key, [])
        byBase.get(key).push({ bucket, name: f.name })
      }
      if (data.length < limit) break
      offset += limit
    }
    existsByBucket.set(bucket, names)
    log(`  ${bucket}: ${names.size} file(s)`)
  }
  return { existsByBucket, byBase }
}

const publicUrl = (bucket, name) => `${PREFIX}${bucket}/${name}`

// Parse a stored URL into { bucket, name } if it is one of our public URLs.
function parseUrl(url) {
  if (typeof url !== 'string' || !url.startsWith(PREFIX)) return null
  const rest = url.slice(PREFIX.length)
  const slash = rest.indexOf('/')
  if (slash === -1) return null
  return { bucket: rest.slice(0, slash), name: decodeURIComponent(rest.slice(slash + 1)) }
}

// Given a referenced URL, return null if it's fine, or the corrected URL.
// 'unresolved' means we couldn't find any matching file anywhere.
function resolve(url, index) {
  const parsed = parseUrl(url)
  if (!parsed) return null // external / non-storage URL, leave alone
  const { bucket, name } = parsed

  // Already valid?
  if (index.existsByBucket.get(bucket)?.has(name)) return null

  const candidates = index.byBase.get(baseNoExt(name).toLowerCase()) ?? []
  if (candidates.length === 0) return 'unresolved'

  // Prefer: same bucket + .webp, then same bucket any ext, then any bucket .webp,
  // then anything.
  const webp = (c) => /\.webp$/i.test(c.name)
  const pick =
    candidates.find((c) => c.bucket === bucket && webp(c)) ||
    candidates.find((c) => c.bucket === bucket) ||
    candidates.find((c) => webp(c)) ||
    candidates[0]

  const fixed = publicUrl(pick.bucket, pick.name)
  return fixed === url ? null : fixed
}

// Extract every storage URL embedded in a content HTML string.
function extractUrls(content) {
  if (typeof content !== 'string') return []
  const re = new RegExp(
    PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"\'\\s<>)]+',
    'g',
  )
  return content.match(re) ?? []
}

async function main() {
  log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
  log(`SUPABASE_URL = ${SUPABASE_URL}\n`)

  log('Indexing Storage buckets:')
  const index = await buildIndex()
  log('')

  const { data: guides, error } = await admin
    .from('guides')
    .select('id, slug, image_url, content')
  if (error) throw new Error(`select guides: ${error.message}`)
  log(`Scanning ${guides.length} guide(s)\n`)

  const stats = { heroFixed: 0, heroUnresolved: 0, inlineFixed: 0, inlineUnresolved: 0 }

  for (const g of guides) {
    const label = g.slug || g.id

    // ── Hero image ──
    const heroFix = resolve(g.image_url, index)
    if (heroFix === 'unresolved') {
      stats.heroUnresolved++
      log(`  [${label}] HERO unresolved → ${g.image_url}`)
    } else if (heroFix) {
      stats.heroFixed++
      log(`  [${label}] HERO`)
      log(`      old: ${g.image_url}`)
      log(`      new: ${heroFix}`)
      if (APPLY) {
        const { error: uErr } = await admin
          .from('guides').update({ image_url: heroFix }).eq('id', g.id)
        if (uErr) throw new Error(`update hero ${label}: ${uErr.message}`)
      }
    }

    // ── Inline content images ──
    let content = g.content
    let contentChanged = false
    const urls = [...new Set(extractUrls(content))]
    for (const url of urls) {
      const fix = resolve(url, index)
      if (fix === 'unresolved') {
        stats.inlineUnresolved++
        log(`  [${label}] INLINE unresolved → ${url}`)
      } else if (fix) {
        stats.inlineFixed++
        log(`  [${label}] INLINE`)
        log(`      old: ${url}`)
        log(`      new: ${fix}`)
        content = content.split(url).join(fix)
        contentChanged = true
      }
    }
    if (APPLY && contentChanged) {
      const { error: cErr } = await admin
        .from('guides').update({ content }).eq('id', g.id)
      if (cErr) throw new Error(`update content ${label}: ${cErr.message}`)
    }
  }

  log('\nSummary')
  log(`  Hero images   — fixable: ${stats.heroFixed}, unresolved: ${stats.heroUnresolved}`)
  log(`  Inline images — fixable: ${stats.inlineFixed}, unresolved: ${stats.inlineUnresolved}`)
  if (!APPLY) {
    log('\nDry-run only. Re-run with --apply to write these fixes.')
  } else {
    log('\nApplied. Unresolved entries (if any) need a manual look — no matching file in Storage.')
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
