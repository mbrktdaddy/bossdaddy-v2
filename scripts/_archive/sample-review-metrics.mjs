/**
 * Boss Daddy v2 — Sample published review metrics
 *
 * Pulls up to 5 published reviews and reports body length, section count,
 * and which structured fields are populated. Used to ground-truth the
 * "page is too text-heavy / too redundant" conversation.
 *
 * Usage (PowerShell):
 *   node scripts/sample-review-metrics.mjs
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
  .from('reviews')
  .select('slug, title, product_name, rating, tldr, key_takeaways, pros, cons, best_for, not_for, faqs, testing_duration, price_paid_cents, how_you_used_it, standout_moment, content')
  .eq('status', 'approved')
  .order('published_at', { ascending: false })
  .limit(5)

if (error) {
  console.error('Query failed:', error)
  process.exit(1)
}

const stripHtml = (html) => (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const countTag = (html, tag) => (html?.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length
const arrLen = (v) => {
  if (!v) return 0
  try { return Array.isArray(v) ? v.length : (typeof v === 'string' ? JSON.parse(v).length : 0) }
  catch { return 0 }
}

console.log(`\nSampled ${data.length} published reviews:\n`)
console.log('='.repeat(80))

let totals = { words: 0, h2: 0, h3: 0, pros: 0, cons: 0, best: 0, notfor: 0, takeaways: 0, faqs: 0 }

for (const r of data) {
  const plain = stripHtml(r.content)
  const words = plain.split(/\s+/).filter(Boolean).length
  const h2 = countTag(r.content, 'h2')
  const h3 = countTag(r.content, 'h3')
  const counts = {
    pros: arrLen(r.pros),
    cons: arrLen(r.cons),
    best_for: arrLen(r.best_for),
    not_for: arrLen(r.not_for),
    key_takeaways: arrLen(r.key_takeaways),
    faqs: arrLen(r.faqs),
  }

  totals.words += words
  totals.h2 += h2
  totals.h3 += h3
  totals.pros += counts.pros
  totals.cons += counts.cons
  totals.best += counts.best_for
  totals.notfor += counts.not_for
  totals.takeaways += counts.key_takeaways
  totals.faqs += counts.faqs

  console.log(`\n${r.slug}`)
  console.log(`  title:           ${r.title}`)
  console.log(`  product:         ${r.product_name}`)
  console.log(`  rating:          ${r.rating ?? 'null'}`)
  console.log(`  body words:      ${words}`)
  console.log(`  body h2/h3:      ${h2} / ${h3}`)
  console.log(`  tldr length:     ${r.tldr ? r.tldr.length + ' chars' : 'MISSING'}`)
  console.log(`  key_takeaways:   ${counts.key_takeaways}`)
  console.log(`  pros / cons:     ${counts.pros} / ${counts.cons}`)
  console.log(`  best_for/not:    ${counts.best_for} / ${counts.not_for}`)
  console.log(`  faqs:            ${counts.faqs}`)
  console.log(`  testing_duration:${r.testing_duration ? ' "' + r.testing_duration + '"' : ' MISSING'}`)
  console.log(`  price_paid:      ${r.price_paid_cents != null ? '$' + (r.price_paid_cents/100).toFixed(2) : 'MISSING'}`)
  console.log(`  how_you_used:    ${r.how_you_used_it ? r.how_you_used_it.length + ' chars' : 'MISSING'}`)
  console.log(`  standout_moment: ${r.standout_moment ? r.standout_moment.length + ' chars' : 'MISSING'}`)
}

const n = data.length || 1
console.log('\n' + '='.repeat(80))
console.log('AVERAGES across sample:')
console.log(`  body words:    ${Math.round(totals.words / n)}`)
console.log(`  h2 sections:   ${(totals.h2 / n).toFixed(1)}`)
console.log(`  h3 sub-secs:   ${(totals.h3 / n).toFixed(1)}`)
console.log(`  pros/cons:     ${(totals.pros / n).toFixed(1)} / ${(totals.cons / n).toFixed(1)}`)
console.log(`  best_for/not:  ${(totals.best / n).toFixed(1)} / ${(totals.notfor / n).toFixed(1)}`)
console.log(`  takeaways:     ${(totals.takeaways / n).toFixed(1)}`)
console.log(`  faqs:          ${(totals.faqs / n).toFixed(1)}`)
