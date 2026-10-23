// Backfill media_assets.width / height (migration 166) for rows that predate
// the column: reads each stored file's header with sharp and writes the
// intrinsic size back. Public pages use these to render body figures through
// next/image without layout shift, so run this once after applying 166.
//
// Usage:
//   node scripts/backfill-media-dimensions.mjs            # measure + write
//   node scripts/backfill-media-dimensions.mjs --dry-run  # measure, print, no writes
//   node scripts/backfill-media-dimensions.mjs --limit 50
//
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (in .env.local).
// Only rows with width IS NULL are touched; re-running is a no-op once done.
// Private buckets (dm-media, family-photos) are not in media_assets, so a public
// GET of `url` is enough. A fetch or decode failure is reported and skipped —
// never written as zeros.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

function loadEnv() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/)
      if (!m) continue
      const [, k, raw] = m
      if (!process.env[k]) process.env[k] = raw.trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* env may already be provided by the shell */ }
}
loadEnv()

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !SERVICE_KEY) {
  console.error('✖ Missing env: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY — check .env.local')
  process.exit(1)
}

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 5000
const CONCURRENCY = 4

const supabase = createClient(URL_BASE, SERVICE_KEY, { auth: { persistSession: false } })

async function measure(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const meta = await sharp(buf).metadata()
  if (!meta.width || !meta.height) throw new Error('no dimensions in header')
  // Animated images report the frame strip as height; pageHeight is one frame.
  const height = (meta.pages ?? 1) > 1 ? (meta.pageHeight ?? meta.height) : meta.height
  return { width: meta.width, height }
}

async function main() {
  const { data: rows, error } = await supabase
    .from('media_assets')
    .select('id, url, bucket, filename')
    .is('width', null)
    .order('created_at', { ascending: true })
    .limit(LIMIT)
  if (error) { console.error('✖ query failed:', error.message); process.exit(1) }
  console.log(`${rows.length} asset(s) without dimensions${DRY ? ' (dry run)' : ''}`)

  let done = 0, failed = 0
  const queue = [...rows]
  async function worker() {
    while (queue.length) {
      const row = queue.shift()
      try {
        const { width, height } = await measure(row.url)
        if (!DRY) {
          const { error: upErr } = await supabase.from('media_assets').update({ width, height }).eq('id', row.id)
          if (upErr) throw new Error(upErr.message)
        }
        done++
        console.log(`✓ ${row.bucket}/${row.filename} → ${width}×${height}`)
      } catch (err) {
        failed++
        console.warn(`✗ ${row.bucket}/${row.filename}: ${err instanceof Error ? err.message : err}`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`\n${done} measured${DRY ? '' : ' + written'}, ${failed} failed.`)
  if (failed) process.exitCode = 1
}

main()
