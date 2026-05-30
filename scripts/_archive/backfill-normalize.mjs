// Re-encode every media_assets image through the normalize pipeline:
//   rotate (EXIF auto-orient) → resize fit:inside ≤1600px → WebP q=82
//
// - .webp files: overwrite in-place (URL and path unchanged)
// - .jpg/.jpeg files: upload to a new .webp path, update all DB refs, delete original
//
// Usage:
//   node --env-file=.env.local scripts/backfill-normalize.mjs           # dry-run
//   node --env-file=.env.local scripts/backfill-normalize.mjs --apply   # execute
//   ... --apply --skip-webp    # skip rows already mime_type='image/webp' (fast re-run)

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const APPLY      = process.argv.includes('--apply')
const SKIP_WEBP  = process.argv.includes('--skip-webp')
const MAX_PX     = 1600
const QUALITY    = 82
const MIN_PX     = 400   // skip images shorter than this on the smallest edge
const PACE_MS    = 300   // ms between iterations to avoid connection pool saturation

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const log = (...a) => console.log(...a)
log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'} | skip-webp: ${SKIP_WEBP}\n`)

// ── helpers ──────────────────────────────────────────────────────────────────

function storagePath(bucket, url) {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/`
  const clean  = url.split('?')[0]
  return clean.startsWith(prefix) ? clean.slice(prefix.length) : null
}

function publicUrl(bucket, path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function withRetry(fn, label, attempts = 3) {
  const delays = [1000, 3000, 8000]
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === attempts - 1) throw err
      const msg   = err instanceof Error ? err.message : String(err)
      const delay = delays[i] ?? 5000
      log(`  ${label}: ${msg} — retry ${i + 1}/${attempts - 1} in ${delay}ms`)
      await sleep(delay)
    }
  }
  throw new Error('unreachable')
}

async function normalizeBuffer(input) {
  const meta = await sharp(input).metadata()
  const minEdge = Math.min(meta.width ?? 0, meta.height ?? 0)
  if (minEdge > 0 && minEdge < MIN_PX) {
    throw Object.assign(new Error(`Image too small (${minEdge}px shortest edge)`), { skip: true })
  }
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: MAX_PX, height: MAX_PX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer({ resolveWithObject: true })
  return { buffer: data, width: info.width, height: info.height }
}

async function downloadFile(bucket, path) {
  const { data, error } = await admin.storage.from(bucket).download(path)
  if (error) throw new Error(`download ${bucket}/${path}: ${error.message}`)
  return Buffer.from(await data.arrayBuffer())
}

async function uploadFile(bucket, path, buffer) {
  const { error } = await admin.storage
    .from(bucket)
    .upload(path, buffer, { contentType: 'image/webp', upsert: true })
  if (error) throw new Error(`upload ${bucket}/${path}: ${error.message}`)
}

async function deleteFile(bucket, path) {
  const { error } = await admin.storage.from(bucket).remove([path])
  if (error) throw new Error(`delete ${bucket}/${path}: ${error.message}`)
}

// Update all DB columns that might hold a reference to this URL.
async function rewriteUrls(oldUrl, newUrl, newFilename, assetId) {
  const { error: e1 } = await admin
    .from('media_assets')
    .update({ url: newUrl, filename: newFilename })
    .eq('id', assetId)
  if (e1) throw new Error(`media_assets url update: ${e1.message}`)

  const heroTables = [
    { table: 'products',    col: 'image_url' },
    { table: 'reviews',     col: 'image_url' },
    { table: 'guides',      col: 'image_url' },
    { table: 'collections', col: 'hero_image_url' },
  ]
  for (const { table, col } of heroTables) {
    await admin.from(table).update({ [col]: newUrl }).eq(col, oldUrl)
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Fetch all media_assets rows from the 'media' bucket only.
  // Avatars (256px square) and deleted-route buckets are excluded.
  let query = admin
    .from('media_assets')
    .select('id, url, bucket, filename, file_size, mime_type')
    .eq('bucket', 'media')
    .order('created_at', { ascending: true })

  if (SKIP_WEBP) query = query.neq('mime_type', 'image/webp')

  const { data: rows, error } = await query
  if (error) throw new Error(`fetch media_assets: ${error.message}`)

  log(`Found ${rows.length} media_assets row(s)${SKIP_WEBP ? ' (non-webp only)' : ''}\n`)

  if (!APPLY) {
    log('Dry-run — would normalize all images above and update file_size + mime_type in DB.')
    log('Re-run with --apply to execute.')
    return
  }

  const stats = {
    normalized: 0, skipped: 0, failed: 0,
    sumBefore: 0, sumAfter: 0,
    urlChanged: 0,
  }

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i]
    const prefix = `[${i + 1}/${rows.length}] ${row.bucket} / ${row.filename}`

    try {
      const path = storagePath(row.bucket, row.url)
      if (!path) {
        log(`${prefix} → cannot parse storage path, skipping`)
        stats.skipped++
        continue
      }

      const raw     = await withRetry(() => downloadFile(row.bucket, path), `${prefix} download`)
      let normalized
      try {
        normalized = await normalizeBuffer(raw)
      } catch (e) {
        if (e.skip) {
          log(`${prefix} → ${e.message}, skipping`)
          stats.skipped++
          continue
        }
        throw e
      }

      const isWebp    = path.toLowerCase().endsWith('.webp')
      const newPath   = isWebp ? path : path.replace(/\.(jpe?g)$/i, '.webp')
      const newUrl    = publicUrl(row.bucket, newPath)
      const urlChange = newPath !== path

      await withRetry(() => uploadFile(row.bucket, newPath, normalized.buffer), `${prefix} upload`)

      if (urlChange) {
        await rewriteUrls(row.url, newUrl, newPath.split('/').pop(), row.id)
        await withRetry(() => deleteFile(row.bucket, path), `${prefix} delete original`)
        stats.urlChanged++
      }

      await admin
        .from('media_assets')
        .update({ file_size: normalized.buffer.length, mime_type: 'image/webp' })
        .eq('id', row.id)

      stats.sumBefore += raw.length
      stats.sumAfter  += normalized.buffer.length
      stats.normalized++

      const dim = `${normalized.width}×${normalized.height}`
      const kb  = (n) => (n / 1024).toFixed(0)
      log(`${prefix} → ${kb(raw.length)}KB → ${kb(normalized.buffer.length)}KB ${dim}${urlChange ? ' (url updated)' : ''}`)
    } catch (err) {
      stats.failed++
      log(`${prefix} → FAILED: ${err instanceof Error ? err.message : err}`)
    }

    await sleep(PACE_MS)
  }

  const savedMB = (stats.sumBefore - stats.sumAfter) / 1024 / 1024
  log('\nSummary')
  log(`  Normalized: ${stats.normalized}`)
  log(`  Skipped:    ${stats.skipped}`)
  log(`  Failed:     ${stats.failed}`)
  log(`  URL changed: ${stats.urlChanged}`)
  if (stats.sumBefore > 0) {
    log(`  Size: ${(stats.sumBefore/1024/1024).toFixed(1)} MB → ${(stats.sumAfter/1024/1024).toFixed(1)} MB (saved ${savedMB.toFixed(1)} MB)`)
  }
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : err)
  process.exit(1)
})
