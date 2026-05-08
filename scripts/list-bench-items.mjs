/**
 * Boss Daddy v2 — List bench (wishlist) items
 *
 * Prints every wishlist_items row so we can identify placeholders to delete.
 *
 * Usage (PowerShell):
 *   node scripts/list-bench-items.mjs
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

const { data, error } = await supabase
  .from('wishlist_items')
  .select('id, slug, title, status, priority, description, created_at, review_id')
  .order('priority', { ascending: false })
  .order('created_at', { ascending: false })

if (error) {
  console.error('Query failed:', error)
  process.exit(1)
}

console.log(`\nFound ${data.length} wishlist items:\n`)
for (const item of data) {
  console.log(`[${item.status.padEnd(11)}] ${item.slug}`)
  console.log(`              title: ${item.title}`)
  console.log(`              id:    ${item.id}`)
  if (item.description) console.log(`              desc:  ${item.description.slice(0, 80)}`)
  console.log()
}
