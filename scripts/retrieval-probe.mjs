// Retrieval BEFORE/AFTER probe — `npm run ai:probe-retrieval`.
//
// Diagnoses and validates the fix for: "what are the best gas grills" returned
// NO tested pick, while an approved 8/10 six-months-tested Weber gas grill sat in
// the vault. Root cause: both retrieval sides were built from title +
// product_name + excerpt only. The 9,310-char body was indexed nowhere.
//
// This is READ-ONLY. It rebuilds the WIDENED embedding text in memory (mirroring
// lib/boss/embedContent.ts) and embeds it, so the improvement is measurable
// BEFORE migration 130 is applied to prod. Nothing is written.
//
// A safe MIN_SIMILARITY must sit above every CONTROL and below every TARGET.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { embed } from 'ai'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMBEDDING_MODEL = 'cohere/embed-v4.0'

// Read the live floor out of search_gear rather than duplicating it — a probe that
// silently disagrees with the code it validates is worse than no probe.
const CURRENT_FLOOR = (() => {
  const src = readFileSync(new URL('../lib/boss/tools/search_gear.ts', import.meta.url), 'utf8')
  const m = src.match(/const MIN_SIMILARITY\s*=\s*([\d.]+)/)
  if (!m) throw new Error('could not read MIN_SIMILARITY from search_gear.ts')
  return Number(m[1])
})()
const WEBER = 'weber-genesis-e-330-stealth-review-premium-grill-real-results'

const TARGETS = [
  'gas grills',
  'best gas grills',
  'weber gas grills',
  'grill',
  'gas grill for the backyard',
  'propane grill',
  'what should I cook burgers on',
]
const CONTROLS = ['stroller', 'cordless drill', 'baby formula', 'pellet smoker', 'kids water table']

// ── mirrors lib/boss/embedContent.ts — keep in sync ──
const BODY_CHARS = 1800
const bodyText = (c) =>
  !c ? '' : c.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, BODY_CHARS)
const categoryText = (c) => (c ? c.replace(/-/g, ' ') : '')
const reviewText = (r) =>
  [r.title, r.product_name, categoryText(r.category), r.excerpt, r.tldr, bodyText(r.content)]
    .filter(Boolean).join('\n').trim()

const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
const parseVec = (v) => (typeof v === 'string' ? JSON.parse(v) : v)

const embedAs = async (value, inputType) =>
  (await embed({ model: EMBEDDING_MODEL, value, providerOptions: { cohere: { inputType } } })).embedding

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: row, error } = await db
    .from('reviews')
    .select('title, product_name, excerpt, tldr, category, content, embedding')
    .eq('slug', WEBER)
    .single()
  if (error || !row) { console.error('load failed:', error?.message); process.exit(1) }

  const before = parseVec(row.embedding)
  const widened = reviewText(row)
  // Documents embed as search_document; queries as search_query (Cohere is asymmetric).
  const after = await embedAs(widened, 'search_document')

  console.log(`doc: ${row.title}`)
  console.log(`embedded text: ${[row.title, row.product_name, row.excerpt].filter(Boolean).join(' ').length} chars BEFORE  ->  ${widened.length} chars AFTER`)
  console.log(`floor: ${CURRENT_FLOOR}\n`)

  const hdr = (t) => console.log(`${t}\n  ${'before'.padStart(6)}  ${'after'.padStart(6)}  ${'delta'.padStart(7)}   verdict            query`)
  const line = (q, b, a, isTarget) => {
    const bOk = b >= CURRENT_FLOOR, aOk = a >= CURRENT_FLOOR
    let v
    if (isTarget) v = !bOk && aOk ? 'FIXED ✓' : bOk && aOk ? 'ok (was ok)' : bOk && !aOk ? 'REGRESSED ✗' : 'still cut ✗'
    else v = !aOk ? 'correctly cut ✓' : 'FALSE POSITIVE ✗'
    console.log(`  ${b.toFixed(4)}  ${a.toFixed(4)}  ${(a - b >= 0 ? '+' : '') + (a - b).toFixed(4)}   ${v.padEnd(18)} ${q}`)
    return { q, b, a, isTarget }
  }

  const out = []
  hdr('TARGETS — should surface the tested pick')
  for (const q of TARGETS) {
    const qv = await embedAs(q, 'search_query')
    out.push(line(q, cosine(qv, before), cosine(qv, after), true))
  }
  console.log()
  hdr('CONTROLS — should NOT surface it')
  for (const q of CONTROLS) {
    const qv = await embedAs(q, 'search_query')
    out.push(line(q, cosine(qv, before), cosine(qv, after), false))
  }

  const t = out.filter((r) => r.isTarget), c = out.filter((r) => !r.isTarget)
  const sep = (key) => {
    const minT = Math.min(...t.map((r) => r[key])), maxC = Math.max(...c.map((r) => r[key]))
    return { minT, maxC, ok: minT > maxC }
  }
  const b = sep('b'), a = sep('a')
  console.log(`\n${''.padEnd(14)}lowest target   highest control   separable?`)
  console.log(`BEFORE        ${b.minT.toFixed(4)}          ${b.maxC.toFixed(4)}            ${b.ok ? 'YES' : 'NO — overlap'}`)
  console.log(`AFTER         ${a.minT.toFixed(4)}          ${a.maxC.toFixed(4)}            ${a.ok ? 'YES' : 'NO — overlap'}`)
  if (a.ok) {
    console.log(`\n✓ separable after widening. Safe floor range: (${a.maxC.toFixed(4)}, ${a.minT.toFixed(4)}), midpoint ${((a.minT + a.maxC) / 2).toFixed(4)}`)
    console.log(`  current floor ${CURRENT_FLOOR} is ${CURRENT_FLOOR > a.minT ? `TOO HIGH — lower it to ~${((a.minT + a.maxC) / 2).toFixed(2)}` : 'safe as-is'}`)
  }
}

main()
