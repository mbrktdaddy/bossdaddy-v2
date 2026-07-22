// Hybrid-search RPC smoke — `npm run hybrid:smoke "<query>"` (loads .env.local).
// Deterministic check of migration 125's boss_hybrid_reviews, decoupled from the
// model: embeds a fixed query as ANON (mirrors the concierge's access + verifies
// the grant/RLS), calls the RPC, and prints each returned slug with its real
// cosine similarity so the MIN_SIMILARITY floor can be tuned on numbers, not guesses.

import { createClient } from '@supabase/supabase-js'
import { embed, cosineSimilarity } from 'ai'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const db = createClient(url, anon, { auth: { persistSession: false } })

const query = process.argv[2] || 'what are some great swing sets for a 5 year old'
const table = process.argv[3] === 'guides' ? 'guides' : 'reviews'
const rpc = table === 'guides' ? 'boss_hybrid_guides' : 'boss_hybrid_reviews'

const { embedding } = await embed({
  model: 'cohere/embed-v4.0',
  value: query,
  providerOptions: { cohere: { inputType: 'search_query' } },
})

// Floor 0 so we see the FULL ranked tail and where relevance drops off.
const { data, error } = await db
  .rpc(rpc, {
    query_text: query,
    query_embedding: JSON.stringify(embedding),
    match_count: 24,
    min_similarity: 0,
  })
  .select('slug, embedding')

if (error) {
  console.error('RPC error:', error)
  process.exit(1)
}

console.log(`\nquery: "${query}"\nreturned ${data.length} rows (floor 0, ranked):\n`)
for (const r of data) {
  const sim = r.embedding ? cosineSimilarity(embedding, JSON.parse(r.embedding)) : NaN
  console.log(`  ${sim.toFixed(4)}  ${r.slug}`)
}
