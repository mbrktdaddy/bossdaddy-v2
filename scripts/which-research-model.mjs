// Which model does each AI bucket resolve to HERE? — `npm run ai:which`.
//
// Exists because a silent local/prod divergence produced three misleading
// measurements: `AI_MODEL_RESEARCH=xai/grok-4.5` is set in Vercel but UNSET in
// .env.local, so local eval runs exercised the bucket DEFAULT (Anthropic web
// search) while production ran Grok. Nothing in the output of those runs said so.
//
// Run this before trusting any local timing or quality measurement of a bucket,
// and prefix the run with the override if you need to match production:
//     AI_MODEL_RESEARCH=xai/grok-4.5 npm run <whatever>
//
// Prints only variable NAMES and model slugs — no secrets.

const BUCKETS = ['CONTENT', 'RESEARCH', 'UTILITY', 'MODERATION', 'CONCIERGE']
const LANES = ['CONCIERGE_SENSITIVE', 'CONCIERGE_FAST']

console.log('AI bucket overrides in this environment\n')
for (const b of [...BUCKETS, ...LANES]) {
  const key = `AI_MODEL_${b}`
  const val = process.env[key]
  const note =
    b === 'MODERATION' && !val
      ? '(compliance-pinned — an override here is ignored by design)'
      : !val
        ? '(unset → bucket default in lib/flags.ts)'
        : ''
  console.log(`  ${key.padEnd(30)} ${val ?? '—'}  ${note}`)
}
console.log('\nBucket defaults live in lib/flags.ts; slugs in lib/ai/models.ts.')
