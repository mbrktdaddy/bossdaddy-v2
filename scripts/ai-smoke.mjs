// AI Gateway smoke test — run with `npm run ai:smoke` (loads .env.local).
// Verifies: (1) gateway auth works, (2) a live generateObject call through the
// gateway returns a schema-valid object, (3) which providers/models the gateway
// actually serves (settles the xai/grok availability question authoritatively).
//
// Makes one tiny real (paid) call. Dev tool only — not imported by the app.

import { gateway, generateObject } from 'ai'
import { z } from 'zod'

async function main() {
  // 1 + 3: list available models (also confirms auth).
  let modelIds = []
  try {
    const res = await gateway.getAvailableModels()
    const arr = Array.isArray(res) ? res : (res.models ?? res.data ?? [])
    modelIds = arr.map((m) => m.id ?? m.modelId ?? m).filter(Boolean)
    const anthropic = modelIds.filter((id) => String(id).startsWith('anthropic/'))
    const xai = modelIds.filter((id) => String(id).startsWith('xai/'))
    console.log(`models available: ${modelIds.length} total`)
    console.log(`  anthropic (${anthropic.length}): ${anthropic.join(', ') || '—'}`)
    console.log(`  xai/grok  (${xai.length}): ${xai.join(', ') || 'NONE'}`)
  } catch (err) {
    console.error('FAIL: getAvailableModels threw —', err?.message ?? err)
    process.exit(1)
  }

  // 2: live structured call through the gateway with our exact call shape.
  try {
    const { object, usage } = await generateObject({
      model: gateway('anthropic/claude-sonnet-4.6'),
      schema: z.object({ ok: z.boolean(), word: z.string() }),
      prompt: 'Respond by returning ok=true and word set to "pong". Nothing else.',
      maxOutputTokens: 100,
      providerOptions: { gateway: { tags: ['surface:ai-smoke'] } },
    })
    console.log('generateObject OK:', JSON.stringify(object), '| tokens:', usage?.totalTokens)
    console.log(object.ok && object.word ? 'SMOKE PASS' : 'SMOKE WARN: unexpected object')
  } catch (err) {
    console.error('FAIL: generateObject threw —', err?.message ?? err)
    process.exit(1)
  }
}

main()
