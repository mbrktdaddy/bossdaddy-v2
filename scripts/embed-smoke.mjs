// Embedding smoke test — run with `npm run embed:smoke` (loads .env.local).
// De-risks the semantic-retrieval migration BEFORE writing SQL by settling the
// three things a wrong guess would force a re-do on:
//   1. the EXACT output dimension of `cohere/embed-v4.0` via the gateway — the
//      pgvector column must match it exactly;
//   2. that the model is reachable with this key (the free local key 403s on some
//      premium models — same Haiku gate we hit before);
//   3. that Cohere's asymmetric inputType (search_document vs search_query) passes
//      through the gateway, and that it actually separates a relevant doc from an
//      irrelevant one (swing set vs baby formula — the exact junk-card case).
//
// Makes a few tiny real (paid) calls. Dev tool only — not imported by the app.

import { embed, cosineSimilarity } from 'ai'

const MODEL = 'cohere/embed-v4.0'

async function embedText(value, inputType) {
  const { embedding } = await embed({
    model: MODEL,
    value,
    providerOptions: { cohere: { inputType }, gateway: { tags: ['surface:embed-smoke'] } },
  })
  return embedding
}

async function main() {
  let dims
  try {
    const doc = await embedText('Gorilla Playsets Wilderness Gym cedar swing set for the backyard', 'search_document')
    dims = doc.length
    console.log(`${MODEL} reachable · output dimensions = ${dims}`)

    const query = await embedText('what are some good swing sets for a 5 year old', 'search_query')
    const formula = await embedText('Enfamil Optimum Enspire ready-to-feed baby formula', 'search_document')

    const simRelevant = cosineSimilarity(query, doc)
    const simIrrelevant = cosineSimilarity(query, formula)
    console.log(`  sim(query, swing-set doc)   = ${simRelevant.toFixed(4)}`)
    console.log(`  sim(query, baby-formula doc) = ${simIrrelevant.toFixed(4)}`)
    console.log(
      simRelevant > simIrrelevant
        ? `SMOKE PASS — semantic separation works (gap ${(simRelevant - simIrrelevant).toFixed(4)}); pgvector column = vector(${dims})`
        : 'SMOKE WARN — relevant doc did NOT outrank the irrelevant one; revisit before building',
    )
  } catch (err) {
    console.error('FAIL: embed threw —', err?.message ?? err)
    console.error('If this is a 403/model-not-available, the local free key gates this model (prod pro-team key is fine).')
    process.exit(1)
  }
}

main()
