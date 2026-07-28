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

// How much of the BODY feeds the embedding. Widened from headline-only in
// migration 130: a 9,310-char review of a gas grill scored only 0.27 against
// "gas grills" because the vector was built from ~100 chars of title + excerpt
// and had never seen the words propane, burner, or sear zone.
//
// Capped rather than unbounded on purpose. A single vector over a whole article
// drifts toward the average of everything the article discusses, so dumping 9k
// chars can REDUCE discrimination even as it raises recall. The opening of a
// piece is also its most on-topic part — intro and early sections state what the
// thing IS, while the tail wanders into edge cases. Verify any change to this
// number with `npm run ai:probe-retrieval`, which prints targets vs controls.
const BODY_CHARS = 1800

// Strip markup/entities so the embedding sees prose, not tags. Content is stored
// as sanitized HTML; raw tags would burn budget and add no meaning.
function bodyText(content: string | null): string {
  if (!content) return ''
  return content
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, BODY_CHARS)
}

// A category slug is a token to Postgres but noise to an embedding model —
// "grilling-cooking" reads better as "grilling cooking".
const categoryText = (c: string | null) => (c ? c.replace(/-/g, ' ') : '')

// The text that represents each row in the embedding space. Keep in sync with the
// columns the migration-125 staleness triggers watch (widened in migration 130).
function reviewText(r: {
  title: string | null
  product_name: string | null
  excerpt: string | null
  tldr: string | null
  category: string | null
  content: string | null
}): string {
  return [r.title, r.product_name, categoryText(r.category), r.excerpt, r.tldr, bodyText(r.content)]
    .filter(Boolean)
    .join('\n')
    .trim()
}
function guideText(g: {
  title: string | null
  excerpt: string | null
  tldr: string | null
  category: string | null
  content: string | null
}): string {
  return [g.title, categoryText(g.category), g.excerpt, g.tldr, bodyText(g.content)]
    .filter(Boolean)
    .join('\n')
    .trim()
}

// pgvector accepts the vector as a string literal ("[0.1,0.2,…]"); JSON.stringify
// of a number[] produces exactly that shape.
function toVectorLiteral(v: number[]): string {
  return JSON.stringify(v)
}

async function refreshReviews(admin: Admin): Promise<number> {
  const { data, error } = await admin
    .from('reviews')
    .select('id, title, product_name, excerpt, tldr, category, content')
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
    .select('id, title, excerpt, tldr, category, content')
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
