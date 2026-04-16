/**
 * Boss Daddy v2 — Data Cleanup Script
 *
 * Problems to fix:
 *   1. All 49 rows in `reviews` have category = 'other' (import didn't map categories)
 *   2. 29 of those rows are articles/how-to guides — they belong in `articles`, not `reviews`
 *   3. 14 of those 29 articles are exact duplicates (imported twice)
 *
 * What this script does:
 *   1. Fix categories on the 20 genuine product reviews
 *   2. Deduplicate articles, insert the best copy into `articles`, delete all from `reviews`
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

const supabase = createClient(envVars['NEXT_PUBLIC_SUPABASE_URL'], envVars['SUPABASE_SERVICE_ROLE_KEY'])

// ── Category map for product reviews (matched by slug prefix) ─────────────────
const REVIEW_SLUG_CATEGORY = [
  ['dewalt',               'diy-tools'],
  ['ergobaby',             'kids-family'],
  ['fanhao',               'diy-tools'],
  ['funlio',               'kids-family'],
  ['grill-heat-aid',       'bbq-grilling'],
  ['grownsy',              'kids-family'],
  ['hozereel',             'diy-tools'],
  ['keppi',                'health-fitness'],
  ['lbt-power-tool',       'diy-tools'],
  ['momentous',            'health-fitness'],
  ['nordic-naturals',      'health-fitness'],
  ['nuobell',              'health-fitness'],
  ['pure-encapsulations',  'health-fitness'],
  ['spitjack',             'bbq-grilling'],
  ['step2',                'kids-family'],
  ['superb-home',          'bbq-grilling'],
  ['thorne-basic',         'health-fitness'],
  ['thorne-zinc',          'health-fitness'],
  ['vmaisi',               'kids-family'],
  ['wall-control',         'diy-tools'],
]

// ── Category map for articles (matched by slug prefix) ───────────────────────
const ARTICLE_SLUG_CATEGORY = [
  ['5-home-repairs',                              'diy-tools'],
  ['5-marinades',                                 'bbq-grilling'],
  ['5-weekend-diy',                               'diy-tools'],
  ['beginners-guide-to-smoking-ribs',             'bbq-grilling'],
  ['essential-bbq-gear',                          'bbq-grilling'],
  ['how-to-build-a-backyard-playset',             'kids-family'],
  ['how-to-build-the-ultimate-dad-garage',        'diy-tools'],
  ['how-to-set-up-the-perfect-backyard-bbq',      'bbq-grilling'],
  ['how-to-smoke-a-whole-chicken',                'bbq-grilling'],
  ['how-to-stay-fit-as-a-new-dad',               'health-fitness'],
  ['stress-management-for-dads',                  'health-fitness'],
  ['the-30-minute-dad-workout',                   'health-fitness'],
  ['the-busy-dads-guide-to-building-a-supplement','health-fitness'],
  ['the-dads-complete-guide-to-smoking',          'bbq-grilling'],
  ['the-dads-guide-to-baby-proofing',             'kids-family'],
]

function getCategoryForSlug(slug, map) {
  for (const [prefix, cat] of map) {
    if (slug.startsWith(prefix)) return cat
  }
  return null
}

// Strip the 4-char random suffix from imported slugs (e.g. "-fbik")
function baseSlug(slug) {
  return slug.replace(/-[a-z0-9]{4}$/, '')
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🧹 Starting data cleanup...\n')

  // Fetch all "other" category rows
  const { data: rows, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('category', 'other')

  if (error) { console.error('❌ Fetch error:', error.message); process.exit(1) }
  console.log(`📦 Found ${rows.length} rows with category = 'other'\n`)

  // ── Step 1: Identify product reviews vs articles ─────────────────────────
  const productReviews = []
  const articleRows = []

  for (const row of rows) {
    const reviewCat = getCategoryForSlug(row.slug, REVIEW_SLUG_CATEGORY)
    if (reviewCat) {
      productReviews.push({ ...row, newCategory: reviewCat })
    } else {
      const articleCat = getCategoryForSlug(row.slug, ARTICLE_SLUG_CATEGORY)
      articleRows.push({ ...row, newCategory: articleCat ?? 'other' })
    }
  }

  console.log(`🔍 Classified: ${productReviews.length} product reviews, ${articleRows.length} articles\n`)

  // ── Step 2: Fix product review categories ────────────────────────────────
  console.log('📝 Fixing product review categories...')
  let fixedCount = 0
  for (const r of productReviews) {
    const { error } = await supabase
      .from('reviews')
      .update({ category: r.newCategory })
      .eq('id', r.id)
    if (error) {
      console.log(`  ❌ ${r.slug}: ${error.message}`)
    } else {
      console.log(`  ✅ ${r.newCategory.padEnd(15)} ${r.slug}`)
      fixedCount++
    }
  }
  console.log(`\n  ${fixedCount}/${productReviews.length} product reviews updated\n`)

  // ── Step 3: Deduplicate articles ─────────────────────────────────────────
  // Group by base slug, pick best copy (prefer one with published_at, then longest content)
  const grouped = {}
  for (const row of articleRows) {
    const base = baseSlug(row.slug)
    if (!grouped[base]) grouped[base] = []
    grouped[base].push(row)
  }

  console.log(`📚 Article deduplication: ${Object.keys(grouped).length} unique articles from ${articleRows.length} rows`)
  const duplicateCount = articleRows.length - Object.keys(grouped).length
  console.log(`   (${duplicateCount} duplicates to discard)\n`)

  // Pick the best row from each group
  const articlesToInsert = []
  const allArticleIds = [] // all IDs to delete from reviews after insert

  for (const [base, copies] of Object.entries(grouped)) {
    // Sort: prefer published_at set, then longer content
    const sorted = [...copies].sort((a, b) => {
      if (a.published_at && !b.published_at) return -1
      if (!a.published_at && b.published_at) return 1
      return (b.content?.length ?? 0) - (a.content?.length ?? 0)
    })
    const best = sorted[0]
    articlesToInsert.push({ ...best, cleanSlug: base })
    copies.forEach(c => allArticleIds.push(c.id))
  }

  // ── Step 4: Insert articles ───────────────────────────────────────────────
  console.log('📥 Inserting articles into articles table...')
  let insertedCount = 0
  for (const a of articlesToInsert) {
    const { error } = await supabase
      .from('articles')
      .insert({
        author_id:    a.author_id,
        slug:         a.cleanSlug,
        title:        a.title,
        content:      a.content,
        excerpt:      a.excerpt,
        category:     a.newCategory,
        image_url:    a.image_url,
        status:       a.status,
        published_at: a.published_at,
        created_at:   a.created_at,
      })

    if (error) {
      console.log(`  ❌ ${a.cleanSlug}: ${error.message}`)
    } else {
      console.log(`  ✅ ${a.newCategory.padEnd(15)} ${a.cleanSlug}`)
      insertedCount++
    }
  }
  console.log(`\n  ${insertedCount}/${articlesToInsert.length} articles inserted\n`)

  // ── Step 5: Delete all article rows from reviews table ───────────────────
  if (insertedCount === articlesToInsert.length) {
    console.log(`🗑️  Deleting ${allArticleIds.length} article rows from reviews table...`)
    const { error } = await supabase
      .from('reviews')
      .delete()
      .in('id', allArticleIds)

    if (error) {
      console.log(`  ❌ Delete error: ${error.message}`)
    } else {
      console.log(`  ✅ Deleted ${allArticleIds.length} rows\n`)
    }
  } else {
    console.log('⚠️  Skipping delete — not all articles inserted successfully. Fix errors above and re-run.\n')
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  const { data: finalReviews } = await supabase.from('reviews').select('category', { count: 'exact' })
  const { data: finalArticles } = await supabase.from('articles').select('id', { count: 'exact' })
  const catCounts = {}
  finalReviews?.forEach(r => { catCounts[r.category] = (catCounts[r.category] || 0) + 1 })

  console.log('✅ Cleanup complete!\n')
  console.log('📊 Final state:')
  console.log('  Reviews table:')
  Object.entries(catCounts).forEach(([c, n]) => console.log(`    ${c.padEnd(18)} ${n}`))
  console.log(`  Articles table: ${finalArticles?.length ?? 0} rows`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
