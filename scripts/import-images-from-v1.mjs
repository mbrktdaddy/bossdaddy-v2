/**
 * Boss Daddy v1 → v2 Image Import Script
 *
 * Fetches all images from bossdaddylife.com WordPress media library,
 * matches each to its parent post, finds the corresponding Supabase review,
 * downloads the image, uploads to Supabase Storage, and updates image_url.
 *
 * Usage:
 *   node scripts/import-images-from-v1.mjs
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = resolve(__dirname, '../.env.local')
const envVars = readFileSync(envPath, 'utf8')
  .split('\n')
  .filter(l => l.trim() && !l.startsWith('#'))
  .reduce((acc, line) => {
    const [key, ...rest] = line.split('=')
    if (!key) return acc
    acc[key.trim()] = rest.join('=').trim().split(/\s+#/)[0].trim()
    return acc
  }, {})

const SUPABASE_URL = envVars['NEXT_PUBLIC_SUPABASE_URL']
const SUPABASE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const WP_BASE = 'https://bossdaddylife.com/wp-json/wp/v2'

// ── Fetch all WP media images ─────────────────────────────────────────────────
async function fetchAllMedia() {
  const all = []
  let page = 1
  while (true) {
    const res = await fetch(`${WP_BASE}/media?per_page=50&media_type=image&page=${page}`)
    if (!res.ok || res.status === 400) break
    const items = await res.json()
    if (!items.length) break
    all.push(...items)
    if (items.length < 50) break
    page++
  }
  return all
}

// ── Normalize a string to slug-like keywords for matching ────────────────────
function toKeywords(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter(w => w.length > 2)
}

// ── Match image title to a Supabase review by slug keyword overlap ────────────
async function findReviewByTitle(imageTitle) {
  const keywords = toKeywords(imageTitle)
  if (!keywords.length) return null

  // Use the first 2-3 meaningful keywords as a search
  const searchTerms = keywords.slice(0, 3)

  for (const term of searchTerms) {
    const { data } = await supabase
      .from('reviews')
      .select('id, title, slug, image_url')
      .ilike('slug', `%${term}%`)
      .limit(5)

    if (data?.length) {
      // Pick the one with the most keyword overlap
      const scored = data.map(r => {
        const slugWords = toKeywords(r.slug)
        const overlap = keywords.filter(k => slugWords.includes(k)).length
        return { ...r, overlap }
      }).sort((a, b) => b.overlap - a.overlap)

      if (scored[0].overlap >= 2) return scored[0]
    }
  }
  return null
}

// ── Download image as buffer ──────────────────────────────────────────────────
async function downloadImage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download: ${url}`)
  const buffer = await res.arrayBuffer()
  return { buffer: Buffer.from(buffer), contentType: res.headers.get('content-type') ?? 'image/jpeg' }
}

// ── Upload to Supabase Storage ────────────────────────────────────────────────
async function uploadToStorage(bucket, filename, buffer, contentType) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType,
      upsert: true,
    })
  if (error) throw new Error(`Storage upload error: ${error.message}`)
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filename)
  return publicUrl
}

// ── Find matching Supabase review by WP slug ─────────────────────────────────
async function findReviewBySlug(wpSlug) {
  // Our slugs are "{wp-slug}-{5chars}" so we use LIKE
  const { data } = await supabase
    .from('reviews')
    .select('id, title, image_url')
    .like('slug', `${wpSlug}-%`)
    .limit(1)
    .single()
  return data ?? null
}

// ── Update review image_url ───────────────────────────────────────────────────
async function updateReviewImage(reviewId, imageUrl) {
  const { error } = await supabase
    .from('reviews')
    .update({ image_url: imageUrl })
    .eq('id', reviewId)
  if (error) throw new Error(`DB update error: ${error.message}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
// Skip list — logos, placeholders, brand assets
const SKIP_PATTERNS = ['placeholder', 'bd-logo', 'bd-og', 'bd-favicon', 'favicon', 'woocommerce', 'screenshot']

async function main() {
  console.log('🖼️  Starting image import from v1...\n')

  const media = await fetchAllMedia()
  console.log(`📦 Found ${media.length} images in media library\n`)

  let success = 0
  let skipped = 0
  let failed = 0

  for (const item of media) {
    const title = item.title?.rendered ?? ''
    const sourceUrl = item.source_url
    const filename = sourceUrl?.split('/').pop() ?? ''

    // Skip brand/placeholder assets
    const titleLower = title.toLowerCase()
    const filenameLower = filename.toLowerCase()
    if (SKIP_PATTERNS.some(p => titleLower.includes(p) || filenameLower.includes(p))) {
      console.log(`⏭️  Skipping brand asset: "${title}"`)
      skipped++
      continue
    }

    process.stdout.write(`⏳ Matching: "${title}"...`)

    try {
      const review = await findReviewByTitle(title)
      if (!review) {
        console.log(` ⏭️ No match found`)
        skipped++
        continue
      }

      if (review.image_url) {
        console.log(` ⏭️ Already has image (${review.slug})`)
        skipped++
        continue
      }

      const { buffer, contentType } = await downloadImage(sourceUrl)
      // Sanitize filename — remove special characters that break storage keys
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '-')
      const publicUrl = await uploadToStorage('review-images', safeFilename, buffer, contentType)
      await updateReviewImage(review.id, publicUrl)

      console.log(` ✅ → "${review.slug}"`)
      success++

      await new Promise(r => setTimeout(r, 300))
    } catch (err) {
      console.log(` ❌ Failed: ${err.message}`)
      failed++
    }
  }

  console.log(`\n✅ Image import complete: ${success} imported, ${skipped} skipped, ${failed} failed`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
