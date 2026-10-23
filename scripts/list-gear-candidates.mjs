/**
 * Boss Daddy v2 — List researched gear candidates (read-only)
 *
 * Prints every gear_candidates row that has not been adopted, most-requested
 * first, so the operator can pick the next On the Radar entries. Mirrors
 * list-bench-items.mjs: service-role read, no writes.
 *
 * Usage (PowerShell):
 *   node scripts/list-gear-candidates.mjs            # un-adopted only
 *   node scripts/list-gear-candidates.mjs --all      # include adopted
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
const envVars = readFileSync(envPath, 'utf8')
  .split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'))
  .reduce((acc, line) => {
    const [key, ...rest] = line.split('=')
    if (!key) return acc
    acc[key.trim()] = rest.join('=').trim().split(/\s+#/)[0].trim()
    return acc
  }, {})

const supabase = createClient(
  envVars['NEXT_PUBLIC_SUPABASE_URL'],
  envVars['SUPABASE_SERVICE_ROLE_KEY'],
  { auth: { persistSession: false } },
)

const includeAdopted = process.argv.includes('--all')

let query = supabase
  .from('gear_candidates')
  .select('id, slug, name, brand, category, price_tier, price_text, fit, why, affiliate_url, store, sources, request_count, first_query, adopted_at, adopted_product_id, created_at, last_seen_at')
  .order('request_count', { ascending: false })
  .order('last_seen_at', { ascending: false })
if (!includeAdopted) query = query.is('adopted_at', null)

const { data, error } = await query
if (error) {
  console.error('Query failed:', error)
  process.exit(1)
}

console.log(`\n${data.length} gear candidate${data.length === 1 ? '' : 's'}${includeAdopted ? '' : ' (not adopted)'}:\n`)
for (const c of data) {
  const sources = Array.isArray(c.sources) ? c.sources : []
  console.log(`${c.slug}  [${c.category ?? '-'} · ${c.price_tier ?? '-'} · ${c.price_text ?? '-'} · asked ${c.request_count}x]`)
  console.log(`   name:   ${c.name}${c.brand ? ` (${c.brand})` : ''}`)
  console.log(`   store:  ${c.store}  url: ${c.affiliate_url ?? '-'}`)
  if (c.fit)         console.log(`   fit:    ${c.fit}`)
  if (c.why)         console.log(`   why:    ${c.why}`)
  if (c.first_query) console.log(`   query:  ${c.first_query}`)
  if (sources.length) console.log(`   src:    ${sources.map(s => s.url ?? s.title).join(' | ')}`)
  if (c.adopted_at)  console.log(`   ADOPTED ${c.adopted_at} → ${c.adopted_product_id}`)
  console.log(`   seen:   ${c.created_at} → ${c.last_seen_at}   id: ${c.id}`)
  console.log()
}
