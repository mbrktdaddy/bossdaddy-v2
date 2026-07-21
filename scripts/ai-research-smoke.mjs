// Research-path smoke test — run with:
//   node --env-file=.env.local scripts/ai-research-smoke.mjs
//
// Verifies the ONE unverified assumption behind the research-bucket migration:
// that provider-executed `web_search` (Anthropic, via the gateway) COEXISTS with
// `Output.object` in a single generateText call — i.e. the model actually SEARCHES
// (multiple steps) and THEN returns one schema-valid object, rather than being
// forced to emit the object on step 1 (skipping the search) or erroring.
//
// Makes a few tiny real (paid) web-search calls. Dev tool only.

import { gateway, generateText, Output, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

const MODEL = 'anthropic/claude-sonnet-4.6'

const schema = z.object({
  picks: z
    .array(z.object({ name: z.string(), url: z.string() }))
    .max(3)
    .describe('2-3 real products with a real source URL each'),
})

async function main() {
  console.log(`\n=== research-path smoke: ${MODEL} + web_search + Output.object ===\n`)

  let result
  try {
    result = await generateText({
      model: gateway(MODEL),
      tools: { web_search: anthropic.tools.webSearch_20260209({ maxUses: 3 }) },
      output: Output.object({ schema }),
      stopWhen: stepCountIs(8),
      system: [
        {
          role: 'system',
          content:
            'You research consumer products using LIVE web search. You MUST search the web before answering; never answer from memory. Only include a product if you retrieved a real source URL for it.',
          providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
        },
      ],
      prompt:
        'Find 2 well-reviewed baby monitors available to buy right now. Search reputable review sources, then return them as the structured object with a real source URL for each.',
      maxOutputTokens: 1500,
      providerOptions: { gateway: { tags: ['surface:ai-research-smoke'] } },
    })
  } catch (err) {
    console.error('FAIL: generateText threw —', err?.name, err?.message ?? err)
    if (err?.cause) console.error('  cause:', err.cause?.message ?? err.cause)
    process.exit(1)
  }

  // 1) Did it actually search? Inspect every step's tool calls.
  const steps = result.steps ?? []
  const toolCallNames = steps.flatMap((s) => (s.toolCalls ?? []).map((c) => c.toolName))
  const searchCalls = toolCallNames.filter((n) => n === 'web_search').length
  console.log(`steps: ${steps.length}`)
  console.log(`tool calls across steps: [${toolCallNames.join(', ') || '—'}]`)
  console.log(`web_search calls: ${searchCalls}`)
  console.log(`result.sources: ${(result.sources ?? []).length}`)

  // 2) Did we get a schema-valid object back?
  let object
  try {
    object = result.output
  } catch (err) {
    console.error(`\nresult.output threw — ${err?.name}: ${err?.message ?? err}`)
  }
  console.log(`\noutput object:`)
  console.log(JSON.stringify(object, null, 2))
  console.log(`\nfinishReason: ${result.finishReason} | tokens: ${result.usage?.totalTokens}`)

  // Verdict.
  const picks = object?.picks ?? []
  const hasObject = Array.isArray(picks) && picks.length > 0
  const hasUrls = hasObject && picks.every((p) => /^https?:\/\//.test(p?.url ?? ''))
  console.log('\n=== VERDICT ===')
  console.log(`  searched (>=1 web_search call): ${searchCalls >= 1 ? 'YES' : 'NO'}`)
  console.log(`  returned a valid object:        ${hasObject ? 'YES' : 'NO'}`)
  console.log(`  object picks have real URLs:    ${hasUrls ? 'YES' : 'NO'}`)
  if (searchCalls >= 1 && hasObject) {
    console.log('\nSMOKE PASS — web_search + Output.object COEXIST on the gateway Anthropic path.')
  } else if (!searchCalls) {
    console.log('\nSMOKE FAIL — the model did NOT search (Output.object likely forced the tool on step 1). Use the explicit-output-tool fallback design.')
  } else {
    console.log('\nSMOKE WARN — searched but no usable object. Inspect above.')
  }
}

main()
