/**
 * Boss Daddy v2 — Bulk Product Image Upload
 *
 * Reads product images from Desktop, uploads to Supabase review-images bucket,
 * and updates image_url on the matching review.
 *
 * Usage (PowerShell):
 *   cd C:\Users\msb1c\bossdaddy-v2
 *   node scripts/upload-product-images.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join, dirname, extname } from 'path'
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
  envVars['SUPABASE_SERVICE_ROLE_KEY']
)

const IMAGES_DIR = 'C:\\Users\\msb1c\\Desktop\\Boss Daddy Images'

// Maps Desktop folder/file names (lowercase) to review slug patterns
const IMAGE_TO_SLUG = [
  ['ergobaby',     'ergobaby'],
  ['fanhao',       'fanhao'],
  ['funlio',       'funlio'],
  ['goodyear',     'goodyear'],
  ['grownsy',      'grownsy'],
  ['hozereel',     'hozereel'],
  ['keppi',        'keppi'],
  ['lbt',          'lbt-power-tool'],
  ['momentous',    'momentous'],
  ['nordic',       'nordic-naturals'],
  ['nuobell',      'nuobell'],
  ['pure',         'pure-encapsulations'],
  ['spitjack',     'spitjack'],
  ['step2',        'step2'],
  ['superb',       'superb-home'],
  ['thorne basic', 'thorne-basic'],
  ['thorne zinc',  'thorne-zinc'],
  ['vmaisi',       'vmaisi'],
  ['wall control', 'wall-control'],
]

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function findPrimaryImage(folderPath) {
  try {
    const files = readdirSync(folderPath)
    const images = files.filter(f => IMAGE_EXTS.has(extname(f).toLowerCase()))
    return images.length > 0 ? join(folderPath, images[0]) : null
  } catch {
    return null
  }
}

function getSlugForEntry(entryName) {
  const lower = entryName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
  for (const [pattern, slug] of IMAGE_TO_SLUG) {
    if (lower.includes(pattern)) return slug
  }
  return null
}

async function uploadImage(imagePath, reviewId) {
  const ext = extname(imagePath).toLowerCase().replace('.', '')
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'png' ? 'image/png'
    : 'image/webp'

  const bytes = readFileSync(imagePath)
  const filename = `${reviewId}-${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`

  const { error } = await supabase.storage
    .from('review-images')
    .upload(filename, bytes, { contentType: mimeType, upsert: true })

  if (error) throw new Error(error.message)

  const { data: { publicUrl } } = supabase.storage
    .from('review-images')
    .getPublicUrl(filename)

  return publicUrl
}

async function main() {
  console.log('🚀 Boss Daddy — Product Image Upload\n')

  const entries = readdirSync(IMAGES_DIR)
  let success = 0
  let skipped = 0
  let failed = 0

  for (const entry of entries) {
    const entryPath = join(IMAGES_DIR, entry)
    const isDir = statSync(entryPath).isDirectory()
    const slugPattern = getSlugForEntry(entry)

    if (!slugPattern) {
      console.log(`⏭️  Skipping (no slug match): ${entry}`)
      skipped++
      continue
    }

    // Find the image file
    let imagePath
    if (isDir) {
      imagePath = findPrimaryImage(entryPath)
    } else if (IMAGE_EXTS.has(extname(entry).toLowerCase())) {
      imagePath = entryPath
    }

    if (!imagePath) {
      console.log(`⏭️  Skipping (no image found): ${entry}`)
      skipped++
      continue
    }

    // Find matching review by slug prefix
    const { data: reviews } = await supabase
      .from('reviews')
      .select('id, slug, title')
      .ilike('slug', `${slugPattern}%`)
      .limit(1)

    if (!reviews?.length) {
      console.log(`⏭️  Skipping (no review found for slug "${slugPattern}"): ${entry}`)
      skipped++
      continue
    }

    const review = reviews[0]
    process.stdout.write(`⏳ ${review.title.slice(0, 50)}...`)

    try {
      const publicUrl = await uploadImage(imagePath, review.id)
      await supabase.from('reviews').update({ image_url: publicUrl }).eq('id', review.id)
      console.log(' ✅')
      success++
    } catch (err) {
      console.log(` ❌ ${err.message}`)
      failed++
    }
  }

  console.log(`\n✅ Done: ${success} uploaded, ${skipped} skipped, ${failed} failed`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
