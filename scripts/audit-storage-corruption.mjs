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
    // Split on /\r?\n/, not '\n'. On Windows a CRLF .env.local otherwise leaves a
    // trailing \r on every value, which makes a JWT fail as "Invalid Compact JWS".
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

// Shape-check without ever printing the value — a malformed key fails deep inside
// the client with an opaque "Invalid Compact JWS", which is a miserable thing to
// debug from the outside.
if (!URL_BASE || !SERVICE_KEY) {
  console.error('✖ Missing env:', [
    !URL_BASE && 'NEXT_PUBLIC_SUPABASE_URL',
    !SERVICE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean).join(', '), '— check .env.local')
  process.exitCode = 1
  throw new Error('missing env')
}
// Accept BOTH key generations: the legacy service-role JWT (3 dot-separated
// parts) and the current `sb_secret_…` format, which is not a JWT at all. Only a
// value matching neither is worth flagging — and it's a warning, not a hard stop,
// because guessing wrong about the key format shouldn't block an audit. Never
// print the value itself.
const looksJwt = SERVICE_KEY.split('.').length === 3
const looksNewKey = /^sb_(secret|publishable)_/.test(SERVICE_KEY)
if (!looksJwt && !looksNewKey) {
  console.warn(
    `⚠ SUPABASE_SERVICE_ROLE_KEY is neither a JWT nor an sb_secret_ key (length ${SERVICE_KEY.length}).` +
      ' Continuing anyway — if requests fail as "Invalid Compact JWS", suspect stray quotes or a wrapped line in .env.local.',
  )
}

const args = process.argv.slice(2)
const JSON_OUT = args.includes('--json')
const ONLY_BUCKET = args.includes('--bucket') ? args[args.indexOf('--bucket') + 1] : null

// --paths <file>: one `bucket/path` per line, read over the PUBLIC URL with no
// credentials at all. Added because the service-role client refused the current
// `sb_secret_` key format with an opaque "Invalid Compact JWS", and auditing
// public buckets never needed auth in the first place. Generate the list with:
//   select bucket_id || '/' || name from storage.objects where bucket_id in (...)
const PATHS_FILE = args.includes('--paths') ? args[args.indexOf('--paths') + 1] : null

if (PATHS_FILE) {
  const base = URL_BASE.replace(/\/+$/, '')
  const lines = readFileSync(PATHS_FILE, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const rows = []

  for (const [i, line] of lines.entries()) {
    const slash = line.indexOf('/')
    const bucket = line.slice(0, slash)
    const path = line.slice(slash + 1)
    const url = `${base}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        rows.push({ bucket, path, verdict: 'error', reason: `HTTP ${res.status}` })
      } else {
        const buf = Buffer.from(await res.arrayBuffer())
        rows.push({ bucket, path, bytes: buf.length, ...classify(buf) })
      }
    } catch (err) {
      rows.push({ bucket, path, verdict: 'error', reason: String(err.message ?? err) })
    }
    if (!JSON_OUT) process.stdout.write(`\r  scanned ${i + 1}/${lines.length}`)
  }

  const corrupt = rows.filter((r) => r.verdict === 'corrupt')
  const suspect = rows.filter((r) => r.verdict === 'suspect')
  const errored = rows.filter((r) => r.verdict === 'error')

  if (JSON_OUT) {
    console.log(JSON.stringify({ corrupt, suspect, errored }, null, 2))
  } else {
    console.log('\n' + '─'.repeat(64))
    console.log(`  scanned  ${rows.length}`)
    console.log(`  healthy  ${rows.length - corrupt.length - suspect.length - errored.length}`)
    console.log(`  CORRUPT  ${corrupt.length}`)
    console.log(`  suspect  ${suspect.length}`)
    console.log(`  errored  ${errored.length}`)
    console.log('─'.repeat(64))
    for (const r of corrupt) console.log(`  ✖ ${r.bucket}/${r.path}  [${r.magic}, ${r.bytes.toLocaleString()} bytes, ${r.fffd.toLocaleString()} U+FFFD]`)
    for (const r of suspect) console.log(`  ? ${r.bucket}/${r.path}  [${r.magic}, ${r.bytes?.toLocaleString()} bytes]`)
    for (const r of errored) console.log(`  ! ${r.bucket}/${r.path}  — ${r.reason}`)
    console.log()
  }
  // Nothing below applies to this mode, and no Supabase client was created here,
  // so exiting is clean (the libuv assertion came from tearing down that client).
  process.exit(corrupt.length ? 1 : 0)
}

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
  process.exitCode = 1
  throw new Error('listBuckets failed')
}

const targets = buckets
  .map((b) => b.name)
  .filter((n) => !ONLY_BUCKET || n === ONLY_BUCKET)

if (!targets.length) {
  console.error(`✖ No bucket named "${ONLY_BUCKET}". Found: ${buckets.map((b) => b.name).join(', ')}`)
  process.exitCode = 1
  throw new Error('unknown bucket')
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

// Non-zero exit so this can gate a cleanup task, but set rather than forced:
// process.exit() while the Supabase client still holds open handles trips a libuv
// assertion on Windows and buries the report under a crash dump.
if (results.corrupt.length) process.exitCode = 1

if (JSON_OUT) {
  console.log(JSON.stringify({ corrupt: results.corrupt, suspect: results.suspect, errored: results.errored }, null, 2))
} else {
  const total = results.ok.length + results.corrupt.length + results.suspect.length + results.errored.length
  console.log('\n' + '─'.repeat(60))
  console.log(`  scanned  ${total}`)
  console.log(`  healthy  ${results.ok.length}`)
  console.log(`  CORRUPT  ${results.corrupt.length}`)
  console.log(`  suspect  ${results.suspect.length}   (ambiguous — eyeball these)`)
  console.log(`  errored  ${results.errored.length}`)
  console.log('─'.repeat(60))

  if (results.corrupt.length) {
    const byBucket = {}
    for (const r of results.corrupt) (byBucket[r.bucket] ??= []).push(r)
    console.log('\nCorrupt objects by bucket:')
    for (const [b, rows] of Object.entries(byBucket)) {
      console.log(`\n  ${b} (${rows.length}):`)
      for (const r of rows) console.log(`    ${r.path}  [${r.magic}]`)
    }
    console.log(
      '\nThese cannot be repaired — the original bytes are gone. Regenerate or re-upload.\n',
    )
  } else {
    console.log('\n✓ No corrupted objects found.\n')
  }

  if (results.suspect.length) {
    console.log('Suspect (not called corrupt — check by hand):')
    for (const r of results.suspect) console.log(`  ${r.bucket}/${r.path}  [${r.magic}, ${r.bytes} bytes]`)
    console.log()
  }
}
