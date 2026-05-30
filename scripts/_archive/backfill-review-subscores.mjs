/**
 * Boss Daddy v2 — Backfill sub-scores + would_rebuy for published reviews
 *
 * One-time use after migration 063 applies. Sets educated defaults so the new
 * Verdict Card has data on day one; you can override per-review in the
 * workspace afterward.
 *
 * Usage (PowerShell):
 *   node scripts/backfill-review-subscores.mjs
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

// Slug → sub-scores + would_rebuy. Hand-tuned from each review's content; the
// author can override any of these in the workspace later.
const BACKFILL = {
  'step2-modern-cook-stove-set-review-fun-toy-or-100-mistake': {
    score_quality: 7, score_value: 6, score_ease: 8, score_daily_use: 7, would_rebuy: false,
  },
  'life-extension-palmettoguard-review-solid-prostate-support-at-21': {
    score_quality: 8, score_value: 9, score_ease: 8, score_daily_use: 7, would_rebuy: true,
  },
  'enfamil-optimum-enspire-baby-formula-review-dads-honest-take': {
    score_quality: 9, score_value: 6, score_ease: 8, score_daily_use: 9, would_rebuy: true,
  },
  'ergobaby-alta-hip-seat-baby-carrier-review-dad-tested-daily': {
    score_quality: 10, score_value: 9, score_ease: 10, score_daily_use: 10, would_rebuy: true,
  },
  'momentous-vitamin-d3-review-simple-supplement-solid-results': {
    score_quality: 10, score_value: 8, score_ease: 9, score_daily_use: 9, would_rebuy: true,
  },
}

let success = 0
let failed = 0

for (const [slug, updates] of Object.entries(BACKFILL)) {
  const { data, error } = await supabase
    .from('reviews')
    .update(updates)
    .eq('slug', slug)
    .eq('status', 'approved')
    .select('slug')
    .single()

  if (error) {
    console.error(`FAIL ${slug}:`, error.message)
    failed++
    continue
  }
  if (!data) {
    console.warn(`SKIP ${slug}: no matching approved review found`)
    failed++
    continue
  }
  console.log(`OK   ${slug}  → Q${updates.score_quality} V${updates.score_value} E${updates.score_ease} D${updates.score_daily_use}  rebuy=${updates.would_rebuy}`)
  success++
}

console.log(`\nDone — ${success} updated, ${failed} skipped/failed`)
