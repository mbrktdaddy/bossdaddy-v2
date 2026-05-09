#!/usr/bin/env node
/**
 * Copies every object from the article-images bucket to guide-images.
 * Run once, after migration 035 creates the guide-images bucket.
 *
 * Usage:
 *   node scripts/migrate-article-images.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 */

import { createClient } from '@supabase/supabase-js'

// Env vars injected by --env-file flag (Node 20+)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const SOURCE = 'article-images'
const TARGET = 'guide-images'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function listAll(bucket, prefix = '') {
  const all = []
  let offset = 0
  const PAGE = 100
  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix || undefined, { limit: PAGE, offset })
    if (error) throw new Error(`list error: ${error.message}`)
    if (!data || data.length === 0) break
    for (const item of data) {
      if (item.id === null) {
        // folder — recurse
        const sub = await listAll(bucket, prefix ? `${prefix}/${item.name}` : item.name)
        all.push(...sub)
      } else {
        all.push(prefix ? `${prefix}/${item.name}` : item.name)
      }
    }
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

async function run() {
  console.log(`Listing files in ${SOURCE}…`)
  const files = await listAll(SOURCE)
  console.log(`Found ${files.length} file(s)`)

  if (files.length === 0) {
    console.log('Nothing to copy.')
    return
  }

  let copied = 0
  let skipped = 0
  let errors = 0

  for (const path of files) {
    // Check if already exists in target (idempotent re-runs)
    const { data: existing } = await supabase.storage.from(TARGET).list(
      path.includes('/') ? path.split('/').slice(0, -1).join('/') : undefined,
      { search: path.split('/').pop() }
    )
    if (existing && existing.some((f) => f.name === path.split('/').pop())) {
      console.log(`  skip  ${path}`)
      skipped++
      continue
    }

    // Download from source
    const { data: blob, error: dlErr } = await supabase.storage.from(SOURCE).download(path)
    if (dlErr || !blob) {
      console.error(`  ERROR downloading ${path}: ${dlErr?.message}`)
      errors++
      continue
    }

    // Upload to target
    const buffer = Buffer.from(await blob.arrayBuffer())
    const contentType = blob.type || 'image/png'
    const { error: upErr } = await supabase.storage
      .from(TARGET)
      .upload(path, buffer, { contentType, upsert: false })

    if (upErr) {
      console.error(`  ERROR uploading ${path}: ${upErr.message}`)
      errors++
      continue
    }

    console.log(`  copy  ${path}`)
    copied++
  }

  console.log(`\nDone — ${copied} copied, ${skipped} already existed, ${errors} errors`)
  if (errors > 0) {
    console.error('Some files failed — fix errors then re-run (script is idempotent).')
    process.exit(1)
  }
  console.log(`\nNext steps:`)
  console.log(`  1. Apply migration 036 (updates guides.image_url in DB)`)
  console.log(`  2. Deploy code (removes article-images references)`)
  console.log(`  3. Verify images load on a few guide pages`)
  console.log(`  4. Delete the article-images bucket in Supabase dashboard`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
