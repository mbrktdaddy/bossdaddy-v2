// Diagnostic: probe OpenAI for dall-e-3 access.
// Usage: node --env-file=.env.local scripts/diag-openai.mjs
//
// 1) Confirms OPENAI_API_KEY is present
// 2) Lists models the key has access to (filters for dall-e/image)
// 3) Attempts a minimal dall-e-3 generation
// Prints the precise OpenAI error so we can tell key/access/model issues apart.

const key = process.env.OPENAI_API_KEY
if (!key) {
  console.error('FAIL: OPENAI_API_KEY is not set in .env.local')
  process.exit(1)
}

const masked = `${key.slice(0, 7)}…${key.slice(-4)} (len ${key.length})`
console.log(`Key present: ${masked}`)

async function listModels() {
  const r = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  })
  const json = await r.json().catch(() => null)
  if (!r.ok) {
    console.error(`\nGET /v1/models -> ${r.status}`)
    console.error(JSON.stringify(json, null, 2))
    return null
  }
  const ids = (json.data ?? []).map((m) => m.id)
  const imageish = ids.filter((id) =>
    /dall|image|gpt-image/i.test(id)
  )
  console.log(`\nModels accessible: ${ids.length}`)
  console.log(`Image-related: ${imageish.length ? imageish.join(', ') : '(none)'}`)
  return ids
}

async function tryModel(model, body) {
  console.log(`\n--- Probing ${model} ---`)
  console.log(`Body: ${JSON.stringify(body)}`)
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, model }),
  })
  const json = await r.json().catch(() => null)
  if (!r.ok) {
    console.error(`  → ${r.status} ${JSON.stringify(json?.error ?? json)}`)
    return false
  }
  console.log(`  → 200 OK (${json.data?.[0]?.b64_json ? 'b64_json' : json.data?.[0]?.url ? 'url' : 'unknown'} response)`)
  return true
}

await listModels()

// Probe gpt-image-2 (pinned) at landscape hero size + high quality —
// the exact config we plan to ship.
await tryModel('gpt-image-2-2026-04-21', {
  prompt: 'an apple on a wooden surface, warm natural light',
  n: 1,
  size: '1536x1024',
  quality: 'high',
})

// Fallback probe: confirm gpt-image-2 still accepts smaller size + medium quality
await tryModel('gpt-image-2-2026-04-21', {
  prompt: 'an apple on a wooden surface',
  n: 1,
  size: '1024x1024',
  quality: 'medium',
})
