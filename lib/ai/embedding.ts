import { embed, embedMany } from 'ai'

// Embeddings for the Boss's grounded retrieval (hybrid search — migration 125).
//
// PINNED model. Vectors are model-specific, so this constant and the vector(1536)
// column in migration 125 move together: changing the model means re-embedding
// every row (drop the column's contents and re-run the backfill). This is a
// TECHNICAL pin (vector-space compatibility), not the LEGAL pin moderation carries
// — so it lives here as a constant, not in the resolveModel bucket machinery.
// Verified reachable + 1536-dim via `npm run embed:smoke`.
export const EMBEDDING_MODEL = 'cohere/embed-v4.0'
export const EMBEDDING_DIMENSIONS = 1536

const TAG = 'surface:boss-embedding'

// Cohere v4 uses ASYMMETRIC embeddings: stored content is embedded as a
// `search_document`, the live query as a `search_query`. Mixing the two quietly
// degrades retrieval quality, so the two paths are kept distinct.
type InputType = 'search_document' | 'search_query'

function providerOptions(inputType: InputType) {
  return { cohere: { inputType }, gateway: { tags: [TAG] } }
}

/** Embed a single user query for retrieval (search_query space). */
export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: text,
    providerOptions: providerOptions('search_query'),
  })
  return embedding
}

/** Embed a batch of stored documents (backfill / cron refresh; search_document space). */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (!texts.length) return []
  const { embeddings } = await embedMany({
    model: EMBEDDING_MODEL,
    values: texts,
    providerOptions: providerOptions('search_document'),
  })
  return embeddings
}
