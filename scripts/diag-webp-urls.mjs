// Diagnostic: figure out why the WebP backfill's first 5 conversions saw
// 0 DB rows updated. For each successful filename, search every column that
// could reference it. Report what URL format is actually stored.
//
// Usage: node --env-file=.env.local scripts/diag-webp-urls.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing env')

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// The 5 files that successfully converted in the first pass (from backfill output).
const FILES = [
  'ai-1776799782365-gxa4t2.png',
]

console.log(`SUPABASE_URL = ${SUPABASE_URL}`)
console.log(`Expected oldUrl pattern: ${SUPABASE_URL}/storage/v1/object/public/guide-images/<filename>\n`)

for (const fname of FILES) {
  console.log(`── ${fname} ──────────────────`)

  // For each table+column with image refs, search for filename substring.
  const tables = [
    { table: 'media_assets', cols: ['url', 'filename'] },
    { table: 'guides',       cols: ['image_url', 'content'] },
    { table: 'reviews',      cols: ['image_url', 'content'] },
    { table: 'pick_lists',   cols: ['hero_image_url'] },
  ]

  let foundAnywhere = false

  for (const { table, cols } of tables) {
    for (const col of cols) {
      const { data, error } = await admin
        .from(table)
        .select(`id, ${col}`)
        .like(col, `%${fname}%`)
        .limit(3)

      if (error) {
        console.log(`  ${table}.${col} → ERROR: ${error.message}`)
        continue
      }
      if (!data || data.length === 0) continue

      foundAnywhere = true
      for (const row of data) {
        const value = row[col]
        const snippet = typeof value === 'string'
          ? (value.length > 200 ? value.slice(0, 200) + '…' : value)
          : String(value)
        console.log(`  ${table}.${col} (id=${row.id}):`)
        console.log(`    "${snippet}"`)
      }
    }
  }

  if (!foundAnywhere) {
    console.log('  → not referenced in any tracked column (orphan upload)')
  }
  console.log()
}
