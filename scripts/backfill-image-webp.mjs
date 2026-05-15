// Backfill: re-encode every legacy .png in our Supabase buckets to WebP @ q=90,
// rewrite DB references, then delete the originals.
//
// Usage:
//   node --env-file=.env.local scripts/backfill-image-webp.mjs           # dry-run
//   node --env-file=.env.local scripts/backfill-image-webp.mjs --apply   # actually do it
//   ... --apply --keep-originals    # skip the deletion step (safest first pass)
//
// Idempotent — re-running skips any .png that already has a .webp sibling
// because the DB will already have been rewritten in the prior run.

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const APPLY           = process.argv.includes('--apply')
const KEEP_ORIGINALS  = process.argv.includes('--keep-originals')
const BUCKETS         = ['guide-images', 'review-images', 'media']
const WEBP_QUALITY    = 90

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const log = (...a) => console.log(...a)
const mode = APPLY ? 'APPLY' : 'DRY-RUN'
log(`Mode: ${mode} | keep-originals: ${KEEP_ORIGINALS}\n`)

function publicUrl(bucket, name) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${name}`
}

async function listAllPngs(bucket) {
  const out = []
  let offset = 0
  const limit = 1000
  while (true) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list('', { limit, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`list ${bucket}: ${error.message}`)
    if (!data || data.length === 0) break
    for (const f of data) {
      if (f.name?.toLowerCase().endsWith('.png')) {
        out.push({ bucket, name: f.name, size: f.metadata?.size ?? 0 })
      }
    }
    if (data.length < limit) break
    offset += limit
  }
  return out
}

async function siblingWebpExists(bucket, pngName) {
  const webpName = pngName.replace(/\.png$/i, '.webp')
  const { data, error } = await admin.storage.from(bucket).list('', {
    search: webpName,
    limit: 1,
  })
  if (error) return false
  return Boolean(data?.some((f) => f.name === webpName))
}

async function downloadPng(bucket, name) {
  const { data, error } = await admin.storage.from(bucket).download(name)
  if (error) throw new Error(`download ${bucket}/${name}: ${error.message}`)
  return Buffer.from(await data.arrayBuffer())
}

async function uploadWebp(bucket, name, buffer) {
  const { error } = await admin.storage
    .from(bucket)
    .upload(name, buffer, { contentType: 'image/webp', upsert: false })
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`upload ${bucket}/${name}: ${error.message}`)
  }
}

async function rewriteDb(oldUrl, newUrl, oldName, newName) {
  // 1. media_assets — url + filename + mime_type
  const { error: maErr, count: maCount } = await admin
    .from('media_assets')
    .update({ url: newUrl, filename: newName, mime_type: 'image/webp' }, { count: 'exact' })
    .eq('url', oldUrl)
  if (maErr) throw new Error(`media_assets update: ${maErr.message}`)

  // 2. guides.image_url + reviews.image_url + pick_lists.hero_image_url
  const heroTables = [
    { table: 'guides',     col: 'image_url' },
    { table: 'reviews',    col: 'image_url' },
    { table: 'pick_lists', col: 'hero_image_url' },
  ]
  let heroCount = 0
  for (const { table, col } of heroTables) {
    const { error, count } = await admin
      .from(table)
      .update({ [col]: newUrl }, { count: 'exact' })
      .eq(col, oldUrl)
    if (error) throw new Error(`${table}.${col} update: ${error.message}`)
    heroCount += count ?? 0
  }

  // 3. Inline references in guides.content + reviews.content
  // Per-row REPLACE via two RPCs would be cleanest, but we don't have one.
  // Instead: fetch rows that contain oldUrl, REPLACE in JS, write back.
  let inlineCount = 0
  for (const table of ['guides', 'reviews']) {
    const { data: rows, error: selErr } = await admin
      .from(table)
      .select('id, content')
      .like('content', `%${oldUrl}%`)
    if (selErr) throw new Error(`${table} content select: ${selErr.message}`)
    for (const row of rows ?? []) {
      const next = row.content.split(oldUrl).join(newUrl)
      if (next === row.content) continue
      const { error: updErr } = await admin
        .from(table)
        .update({ content: next })
        .eq('id', row.id)
      if (updErr) throw new Error(`${table} content update: ${updErr.message}`)
      inlineCount++
    }
  }

  return { mediaAssets: maCount ?? 0, hero: heroCount, inline: inlineCount }
}

async function deleteOriginal(bucket, name) {
  const { error } = await admin.storage.from(bucket).remove([name])
  if (error) throw new Error(`delete ${bucket}/${name}: ${error.message}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Retry a network-dependent operation with backoff. First pass died because
// the Supabase Storage CDN started returning `fetch failed` / `terminated`
// errors after a few large PNG downloads — likely connection pool saturation.
// 3 attempts with 1s / 3s / 8s backoff handles transient failures without
// stalling the whole batch.
async function withRetry(fn, label, attempts = 3) {
  const delays = [1000, 3000, 8000]
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      const isLast = i === attempts - 1
      const msg = err instanceof Error ? err.message : String(err)
      if (isLast) throw err
      const delay = delays[i] ?? 5000
      log(`  ${label}: ${msg} — retry ${i + 1}/${attempts - 1} in ${delay}ms`)
      await sleep(delay)
    }
  }
  throw new Error('unreachable')
}

async function main() {
  // Phase A — inventory
  log('Phase A: inventory')
  const inventory = []
  for (const b of BUCKETS) {
    const pngs = await listAllPngs(b)
    log(`  ${b}: ${pngs.length} png file(s)`)
    inventory.push(...pngs)
  }
  const totalBytes = inventory.reduce((n, f) => n + (f.size || 0), 0)
  log(`  Total: ${inventory.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB\n`)

  if (inventory.length === 0) {
    log('Nothing to do.')
    return
  }

  if (!APPLY) {
    log('Dry-run — would re-encode all files above to WebP, rewrite DB refs, and')
    log(KEEP_ORIGINALS ? '(keep originals)' : 'delete originals.')
    log('Re-run with --apply to execute.')
    return
  }

  // Phase B + C — process each file
  log('Phase B/C: encode, upload, rewrite DB')
  const stats = {
    converted: 0, skipped: 0, failed: 0,
    sumBefore: 0, sumAfter: 0,
    rowsTouched: { mediaAssets: 0, hero: 0, inline: 0 },
  }
  let i = 0
  for (const f of inventory) {
    i++
    const prefix = `[${i}/${inventory.length}] ${f.bucket}/${f.name}`
    try {
      const webpName = f.name.replace(/\.png$/i, '.webp')
      const oldUrl  = publicUrl(f.bucket, f.name)
      const newUrl  = publicUrl(f.bucket, webpName)

      if (await siblingWebpExists(f.bucket, f.name)) {
        log(`${prefix} → sibling .webp exists, skipping encode`)
      } else {
        const png   = await withRetry(() => downloadPng(f.bucket, f.name), `${prefix} download`)
        const webp  = await sharp(png).webp({ quality: WEBP_QUALITY }).toBuffer()
        await withRetry(() => uploadWebp(f.bucket, webpName, webp), `${prefix} upload`)
        stats.sumBefore += png.length
        stats.sumAfter  += webp.length
        log(`${prefix} → ${(png.length/1024).toFixed(0)} KB → ${(webp.length/1024).toFixed(0)} KB`)
      }

      const touched = await rewriteDb(oldUrl, newUrl, f.name, webpName)
      stats.rowsTouched.mediaAssets += touched.mediaAssets
      stats.rowsTouched.hero        += touched.hero
      stats.rowsTouched.inline      += touched.inline

      if (!KEEP_ORIGINALS) {
        await withRetry(() => deleteOriginal(f.bucket, f.name), `${prefix} delete`)
      }
      stats.converted++
    } catch (err) {
      stats.failed++
      log(`${prefix} → FAILED: ${err.message}`)
    }

    // Gentle pacing between iterations to keep the CDN connection pool happy.
    // Total added wall time: ~93 * 250ms ≈ 23s spread over the run.
    await sleep(250)
  }

  log('\nSummary')
  log(`  Converted: ${stats.converted}`)
  log(`  Failed:    ${stats.failed}`)
  if (stats.sumBefore > 0) {
    const savedMB = (stats.sumBefore - stats.sumAfter) / 1024 / 1024
    log(`  Size:      ${(stats.sumBefore/1024/1024).toFixed(1)} MB → ${(stats.sumAfter/1024/1024).toFixed(1)} MB (saved ${savedMB.toFixed(1)} MB)`)
  }
  log(`  DB rows updated:`)
  log(`    media_assets:   ${stats.rowsTouched.mediaAssets}`)
  log(`    hero images:    ${stats.rowsTouched.hero}`)
  log(`    inline content: ${stats.rowsTouched.inline}`)
  log(`  Originals: ${KEEP_ORIGINALS ? 'kept' : 'deleted'}`)
}

main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
