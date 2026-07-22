import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { embedDocuments } from '@/lib/ai/embedding'

// Single source of truth for (re)embedding the Boss's grounded content.
//
// The migration-125 triggers null a row's embedding whenever its embedded source
// text changes (any publish path — single / bulk / cron / submit — so nothing can
// forget to re-embed). This finds every approved+visible review/guide whose
// embedding is null and fills it. On first run (post-migration) that's the whole
// catalog, so this doubles as the one-time backfill. Called by the
// /api/cron/embed-content cron.

type Admin = SupabaseClient<Database>

const BATCH = 64 // Cohere allows up to 96 values/call; stay comfortably under.

// The text that represents each row in the embedding space. Keep in sync with the
// columns the migration-125 staleness triggers watch.
function reviewText(r: { title: string | null; product_name: string | null; excerpt: string | null }): string {
  return [r.title, r.product_name, r.excerpt].filter(Boolean).join('\n').trim()
}
function guideText(g: { title: string | null; excerpt: string | null }): string {
  return [g.title, g.excerpt].filter(Boolean).join('\n').trim()
}

// pgvector accepts the vector as a string literal ("[0.1,0.2,…]"); JSON.stringify
// of a number[] produces exactly that shape.
function toVectorLiteral(v: number[]): string {
  return JSON.stringify(v)
}

async function refreshReviews(admin: Admin): Promise<number> {
  const { data, error } = await admin
    .from('reviews')
    .select('id, title, product_name, excerpt')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .is('embedding', null)
  if (error) throw error
  const rows = (data ?? []).map((r) => ({ id: r.id, text: reviewText(r) })).filter((r) => r.text.length > 0)

  let embedded = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const vectors = await embedDocuments(slice.map((r) => r.text))
    await Promise.all(
      slice.map((r, j) => admin.from('reviews').update({ embedding: toVectorLiteral(vectors[j]) }).eq('id', r.id)),
    )
    embedded += slice.length
  }
  return embedded
}

async function refreshGuides(admin: Admin): Promise<number> {
  const { data, error } = await admin
    .from('guides')
    .select('id, title, excerpt')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .is('embedding', null)
  if (error) throw error
  const rows = (data ?? []).map((g) => ({ id: g.id, text: guideText(g) })).filter((g) => g.text.length > 0)

  let embedded = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const vectors = await embedDocuments(slice.map((r) => r.text))
    await Promise.all(
      slice.map((r, j) => admin.from('guides').update({ embedding: toVectorLiteral(vectors[j]) }).eq('id', r.id)),
    )
    embedded += slice.length
  }
  return embedded
}

export async function refreshStaleEmbeddings(admin: Admin): Promise<{ reviews: number; guides: number }> {
  // Sequential so a large backfill never fires two embed batches at once; the
  // catalog is tiny, so the latency cost is irrelevant.
  const reviews = await refreshReviews(admin)
  const guides = await refreshGuides(admin)
  return { reviews, guides }
}
