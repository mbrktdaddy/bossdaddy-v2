// Audit every Supabase Storage object for the UTF-8 corruption fixed in 569b0a2.
//
// Every upload written from the deployed runtime while that bug was live had its
// bytes UTF-8-decoded: each byte >= 0x80 became U+FFFD (EF BF BD). The files kept
// a valid mimetype and a plausible size, so nothing errored — they simply don't
// decode as images. This walks the buckets, fetches each object, and reports
// which ones are damaged so the cleanup is a list instead of a guess.
//
// Detection lives in scripts/lib/image-integrity.mjs and is unit-tested against a
// real image plus a genuinely mangled copy of it (tests/unit/image-integrity.test.ts).
// It requires BOTH signals to agree — broken magic bytes AND a mass of U+FFFD runs —
// before calling a file corrupt, and reports anything ambiguous as 'suspect' rather
// than guessing, since a false positive here could get a healthy file deleted.
//
// Usage (read-only — never writes or deletes):
//   node scripts/audit-storage-corruption.mjs
//   node scripts/audit-storage-corruption.mjs --bucket media
//   node scripts/audit-storage-corruption.mjs --json > corrupt.json
//
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment
// (already in .env.local). Public buckets are fetched by public URL; private ones
// via a signed URL, so dm-media and avatars are covered too.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { classify } from './lib/image-integrity.mjs'

// -- env ---------------------------------------------------------------------
// Minimal .env.local reader so this runs without extra deps or a Next context.
function loadEnv() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const [, k, raw] = m
      if (!process.env[k]) process.env[k] = raw.replace(/^["']|["']$/g, '')
    }
  } catch { /* env may already be provided by the shell */ }
}
loadEnv()

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !SERVICE_KEY) {
  console.error('✖ Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (check .env.local).')
  process.exit(1)
}

const args = process.argv.slice(2)
const JSON_OUT = args.includes('--json')
const ONLY_BUCKET = args.includes('--bucket') ? args[args.indexOf('--bucket') + 1] : null

const admin = createClient(URL_BASE, SERVICE_KEY, { auth: { persistSession: false } })

// -- storage walk ------------------------------------------------------------
async function listAll(bucket, prefix = '') {
  const out = []
  const PAGE = 100
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
    if (!data?.length) break
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      // A folder has no id/metadata — recurse into it.
      if (entry.id === null) out.push(...(await listAll(bucket, path)))
      else out.push({ path, size: entry.metadata?.size ?? null })
    }
    if (data.length < PAGE) break
  }
  return out
}

async function fetchBytes(bucket, path) {
  const { data, error } = await admin.storage.from(bucket).download(path)
  if (error || !data) throw new Error(error?.message ?? 'download failed')
  return Buffer.from(await data.arrayBuffer())
}

// -- main --------------------------------------------------------------------
const { data: buckets, error: bucketErr } = await admin.storage.listBuckets()
if (bucketErr) {
  console.error('✖ Could not list buckets:', bucketErr.message)
  process.exit(1)
}

const targets = buckets
  .map((b) => b.name)
  .filter((n) => !ONLY_BUCKET || n === ONLY_BUCKET)

if (!targets.length) {
  console.error(`✖ No bucket named "${ONLY_BUCKET}". Found: ${buckets.map((b) => b.name).join(', ')}`)
  process.exit(1)
}

const results = { ok: [], corrupt: [], suspect: [], errored: [] }

for (const bucket of targets) {
  const objects = await listAll(bucket)
  if (!JSON_OUT) console.log(`\n${bucket} — ${objects.length} object${objects.length === 1 ? '' : 's'}`)

  for (const [i, obj] of objects.entries()) {
    let row
    try {
      const buf = await fetchBytes(bucket, obj.path)
      const c = classify(buf)
      row = { bucket, path: obj.path, bytes: buf.length, ...c }
      results[c.verdict === 'ok' ? 'ok' : c.verdict].push(row)
    } catch (err) {
      row = { bucket, path: obj.path, verdict: 'error', reason: String(err.message ?? err) }
      results.errored.push(row)
    }

    if (!JSON_OUT) {
      const mark = { ok: '·', corrupt: '✖', suspect: '?', error: '!' }[row.verdict]
      const detail =
        row.verdict === 'ok'
          ? ''
          : row.verdict === 'error'
            ? ` — ${row.reason}`
            : ` — ${row.magic}, ${row.fffd.toLocaleString()} U+FFFD runs, ${row.bytes.toLocaleString()} bytes`
      // Only print the interesting ones; a progress counter covers the rest.
      if (row.verdict === 'ok') process.stdout.write(`\r  scanned ${i + 1}/${objects.length}`)
      else console.log(`\n  ${mark} ${row.path}${detail}`)
    }
  }
  if (!JSON_OUT) process.stdout.write('\n')
}

if (JSON_OUT) {
  console.log(JSON.stringify({ corrupt: results.corrupt, suspect: results.suspect, errored: results.errored }, null, 2))
  process.exit(0)
}

const total = results.ok.length + results.corrupt.length + results.suspect.length + results.errored.length
console.log('\n' + '─'.repeat(60))
console.log(`  scanned  ${total}`)
console.log(`  healthy  ${results.ok.length}`)
console.log(`  CORRUPT  ${results.corrupt.length}`)
console.log(`  suspect  ${results.suspect.length}   (ambiguous — eyeball these)`)
console.log(`  errored  ${results.errored.length}`)
console.log('─'.repeat(60))

if (results.corrupt.length) {
  // Oldest corrupt object dates the regression, which tells you whether this
  // started with a recent dependency bump or has been live for months.
  const byBucket = {}
  for (const r of results.corrupt) (byBucket[r.bucket] ??= []).push(r.path)
  console.log('\nCorrupt objects by bucket:')
  for (const [b, paths] of Object.entries(byBucket)) {
    console.log(`\n  ${b} (${paths.length}):`)
    for (const p of paths) console.log(`    ${p}`)
  }
  console.log(
    '\nThese cannot be repaired — the original bytes are gone. Regenerate or re-upload.' +
      '\nRe-run after deploying 569b0a2 and generating one new image: it must come back healthy.\n',
  )
  process.exit(1)
}

console.log('\n✓ No corrupted objects found.\n')
