/**
 * Boss Daddy v2 — List products on the spine (read-only)
 *
 * Prints every products row (slug, status, category, source, brand) so an
 * operator can check overlap before adopting a candidate or adding a Radar
 * entry. Mirrors list-bench-items.mjs: service-role read, no writes.
 *
 * Usage (PowerShell):
 *   node scripts/list-products.mjs
 *   node scripts/list-products.mjs weber      # filter: slug/name/brand contains "weber"
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

const needle = (process.argv[2] ?? '').toLowerCase()

const { data, error } = await supabase
  .from('products')
  .select('id, slug, name, brand, status, category, source, store, image_url, radar_take, spotted_at, review_id, created_at')
  .order('status')
  .order('created_at', { ascending: false })

if (error) {
  console.error('Query failed:', error)
  process.exit(1)
}

const rows = needle
  ? data.filter(p => [p.slug, p.name, p.brand].some(v => (v ?? '').toLowerCase().includes(needle)))
  : data

console.log(`\n${rows.length} product${rows.length === 1 ? '' : 's'}${needle ? ` matching "${needle}"` : ''}:\n`)
for (const p of rows) {
  console.log(`[${p.status.padEnd(8)}] ${p.slug}  (${p.category ?? '-'} · ${p.source ?? '-'} · ${p.store ?? '-'}${p.image_url ? ' · img' : ''}${p.review_id ? ' · reviewed' : ''})`)
  console.log(`           ${p.name}${p.brand ? ` — ${p.brand}` : ''}`)
  if (p.radar_take) console.log(`           take: ${p.radar_take.slice(0, 100)}`)
}
console.log()
