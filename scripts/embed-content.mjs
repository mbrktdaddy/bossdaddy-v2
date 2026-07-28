// One-time / manual backfill of the Boss hybrid-search embeddings — run with
// `npm run embed:content` (loads .env.local; uses the service-role key).
//
// The Vercel cron /api/cron/embed-content is the ONGOING freshness mechanism and
// the single APP-runtime implementation (lib/boss/embedContent.ts). This standalone
// ops script exists only so the initial backfill can run without a server or
// CRON_SECRET. It MUST embed with the SAME pinned model as lib/ai/embedding.ts
// (cohere/embed-v4.0, inputType search_document) — a model change is a re-embed
// event, so keep the constant below in sync.

import { createClient } from '@supabase/supabase-js'
import { embedMany } from 'ai'

const MODEL = 'cohere/embed-v4.0' // keep in sync with lib/ai/embedding.ts EMBEDDING_MODEL
const BATCH = 64

// ⚠️ THE TEXT BUILDERS BELOW ARE A HAND-COPY of lib/boss/embedContent.ts.
// This is a .mjs ops script and that is TypeScript, so the duplication is
// structural — but it BIT US: migration 130 widened the app-side builders and
// this script still built the old headline-only text, so running it would have
// silently re-embedded the whole catalog with the narrow vectors it was meant to
// replace. If you change reviewText/guideText/BODY_CHARS there, change them here.
const BODY_CHARS = 1800
const bodyText = (c) =>
  !c ? '' : c.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, BODY_CHARS)
const categoryText = (c) => (c ? c.replace(/-/g, ' ') : '')

const REVIEW_COLS = 'title, product_name, excerpt, tldr, category, content'
const reviewText = (r) =>
  [r.title, r.product_name, categoryText(r.category), r.excerpt, r.tldr, bodyText(r.content)]
    .filter(Boolean).join('\n').trim()

const GUIDE_COLS = 'title, excerpt, tldr, category, content'
const guideText = (g) =>
  [g.title, categoryText(g.category), g.excerpt, g.tldr, bodyText(g.content)]
    .filter(Boolean).join('\n').trim()

// --force re-embeds EVERY approved+visible row, not just rows whose embedding is
// null. Needed whenever the embedded TEXT SHAPE changes: the rows still hold
// valid-looking vectors built from the old shape, so the default null-only pass
// finds nothing to do and the change silently never lands.
const FORCE = process.argv.includes('--force')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

async function embedDocs(texts) {
  const { embeddings } = await embedMany({
    model: MODEL,
    values: texts,
    providerOptions: { cohere: { inputType: 'search_document' }, gateway: { tags: ['surface:embed-backfill'] } },
  })
  return embeddings
}

async function backfill(table, buildText, cols) {
  let q = db
    .from(table)
    .select(`id, ${cols}`)
    .eq('status', 'approved')
    .eq('is_visible', true)
  if (!FORCE) q = q.is('embedding', null)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []).map((r) => ({ id: r.id, text: buildText(r) })).filter((r) => r.text.length > 0)
  let n = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const vecs = await embedDocs(slice.map((r) => r.text))
    await Promise.all(
      slice.map((r, j) => db.from(table).update({ embedding: JSON.stringify(vecs[j]) }).eq('id', r.id)),
    )
    n += slice.length
  }
  return n
}

async function main() {
  console.log(FORCE ? 'FORCE — re-embedding every approved+visible row' : 'filling null embeddings only')
  const reviews = await backfill('reviews', reviewText, REVIEW_COLS)
  const guides = await backfill('guides', guideText, GUIDE_COLS)
  console.log(`Backfill complete — reviews embedded: ${reviews}, guides embedded: ${guides}`)
}

main().catch((e) => {
  console.error('Backfill failed:', e?.message ?? e)
  process.exit(1)
})
