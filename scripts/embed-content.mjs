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
  const { data, error } = await db
    .from(table)
    .select(`id, ${cols}`)
    .eq('status', 'approved')
    .eq('is_visible', true)
    .is('embedding', null)
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
  const reviews = await backfill(
    'reviews',
    (r) => [r.title, r.product_name, r.excerpt].filter(Boolean).join('\n').trim(),
    'title, product_name, excerpt',
  )
  const guides = await backfill(
    'guides',
    (g) => [g.title, g.excerpt].filter(Boolean).join('\n').trim(),
    'title, excerpt',
  )
  console.log(`Backfill complete — reviews embedded: ${reviews}, guides embedded: ${guides}`)
}

main().catch((e) => {
  console.error('Backfill failed:', e?.message ?? e)
  process.exit(1)
})
