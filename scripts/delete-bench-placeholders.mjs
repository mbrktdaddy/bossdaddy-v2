/**
 * Boss Daddy v2 — Delete bench placeholder items
 *
 * Removes the seed/test wishlist_items so they stop appearing on /bench
 * and in the footer carousel. Keeps the Stihl KombiMotor (real testing item).
 *
 * FK cascades handle wishlist_votes + wishlist_subscriptions automatically.
 * Comments on these items are deleted explicitly (no FK).
 *
 * Usage (PowerShell):
 *   node scripts/delete-bench-placeholders.mjs
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

const SLUGS_TO_DELETE = ['test-123', 'placeholder-item-1', 'placeholder-item-2']

const { data: items, error: lookupErr } = await supabase
  .from('wishlist_items')
  .select('id, slug, title')
  .in('slug', SLUGS_TO_DELETE)

if (lookupErr) {
  console.error('Lookup failed:', lookupErr)
  process.exit(1)
}

if (!items?.length) {
  console.log('No matching items found. Nothing to do.')
  process.exit(0)
}

console.log(`Deleting ${items.length} bench placeholder(s):`)
items.forEach((i) => console.log(`  - ${i.slug} (${i.title})`))

const ids = items.map((i) => i.id)

const { error: commentsErr } = await supabase
  .from('comments')
  .delete()
  .eq('content_type', 'wishlist_item')
  .in('content_id', ids)

if (commentsErr) {
  console.error('Comment cleanup failed:', commentsErr)
  process.exit(1)
}

const { error: deleteErr } = await supabase
  .from('wishlist_items')
  .delete()
  .in('id', ids)

if (deleteErr) {
  console.error('Delete failed:', deleteErr)
  process.exit(1)
}

console.log(`\nDone. ${items.length} items removed (votes + subscriptions cascade-deleted).`)
