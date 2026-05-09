/**
 * Boss Daddy v2 — Slug Cleanup Phase 2 backfill
 *
 * Replaces hash-suffixed slugs (ergobaby-...-688fca84) with clean slugs
 * (ergobaby-alta-hip-seat-baby-carrier-review-dad-tested-daily). Old slugs
 * are preserved in legacy_slugs[] so proxy.ts can 301-redirect old URLs.
 *
 * REQUIRES migration 049_legacy_slugs.sql to be applied first.
 *
 * Usage (PowerShell):
 *   node scripts/clean-slugs.mjs              # dry-run, no DB changes
 *   node scripts/clean-slugs.mjs --apply      # actually update DB
 *
 * Strategy:
 *   1. Pull all reviews + guides (id, slug, title, created_at).
 *   2. Sort ASCENDING by created_at — older content claims the clean base
 *      slug; newer collisions get -2, -3, etc. Older URLs likely have more
 *      external links / GSC signal, so they keep the prime slug.
 *   3. Walk the list, building a `taken` set, computing each row's new slug.
 *   4. Print before/after diff (and unchanged count).
 *   5. With --apply: write `slug = new` and append old to `legacy_slugs[]`.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
const envVars = readFileSync(envPath, 'utf8')
  .split('\n').filter(l => l.trim() && !l.startsWith('#'))
  .reduce((acc, line) => {
    const [key, ...rest] = line.split('=')
    if (!key) return acc
    acc[key.trim()] = rest.join('=').trim().split(/\s+#/)[0].trim()
    return acc
  }, {})

const supabase = createClient(
  envVars['NEXT_PUBLIC_SUPABASE_URL'],
  envVars['SUPABASE_SERVICE_ROLE_KEY'],
  { auth: { persistSession: false } }
)

const APPLY = process.argv.includes('--apply')

// Mirrors lib/slug.ts#slugifyTitle. Keep in sync.
const SLUG_MAX = 75

function slugifyTitle(title) {
  let slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics (ü, ñ, é → u, n, e)
    .replace(/['’]/g, '')         // strip straight + curly apostrophes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  if (slug.length > SLUG_MAX) {
    const truncated = slug.slice(0, SLUG_MAX)
    const lastDash = truncated.lastIndexOf('-')
    slug = lastDash > 40 ? truncated.slice(0, lastDash) : truncated
  }

  return slug
}

function planSlugs(rows) {
  const sorted = [...rows].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at))
  )

  const taken = new Set()
  const updates = []
  const unchanged = []

  for (const row of sorted) {
    const base = slugifyTitle(row.title)
    let candidate = base
    let n = 2
    while (taken.has(candidate)) {
      candidate = `${base}-${n}`
      n += 1
    }
    taken.add(candidate)

    if (candidate === row.slug) {
      unchanged.push(row)
    } else {
      updates.push({ ...row, new_slug: candidate })
    }
  }

  return { updates, unchanged }
}

async function processTable(table) {
  console.log(`\n━━━ ${table.toUpperCase()} ━━━`)

  const { data, error } = await supabase
    .from(table)
    .select('id, slug, title, created_at, legacy_slugs')
    .order('created_at', { ascending: true })

  if (error) {
    console.error(`Failed to fetch ${table}:`, error.message)
    process.exit(1)
  }

  // Pre-flight: confirm legacy_slugs column exists.
  if (data.length > 0 && data[0].legacy_slugs === undefined) {
    console.error(`legacy_slugs column missing on ${table}. Apply migration 049 first.`)
    process.exit(1)
  }

  const { updates, unchanged } = planSlugs(data)

  console.log(`Total rows:    ${data.length}`)
  console.log(`Will change:   ${updates.length}`)
  console.log(`Already clean: ${unchanged.length}`)

  if (updates.length === 0) {
    console.log(`Nothing to do for ${table}.`)
    return
  }

  console.log('\nProposed changes:')
  for (const u of updates) {
    console.log(`  ${u.slug}`)
    console.log(`    → ${u.new_slug}`)
  }

  if (!APPLY) {
    console.log(`\n[dry-run] No changes written. Re-run with --apply to commit.`)
    return
  }

  console.log(`\nApplying ${updates.length} updates to ${table}...`)
  let success = 0
  for (const u of updates) {
    const newLegacy = Array.from(new Set([...(u.legacy_slugs ?? []), u.slug]))
    const { error: updateErr } = await supabase
      .from(table)
      .update({ slug: u.new_slug, legacy_slugs: newLegacy })
      .eq('id', u.id)

    if (updateErr) {
      console.error(`  FAILED ${u.slug} → ${u.new_slug}: ${updateErr.message}`)
    } else {
      success += 1
    }
  }
  console.log(`Done. ${success}/${updates.length} updated successfully.`)
}

await processTable('reviews')
await processTable('guides')

console.log('\nFinished.')
