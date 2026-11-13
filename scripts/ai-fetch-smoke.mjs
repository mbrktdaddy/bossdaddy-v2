// URL-read smoke test — run with:
//   npm run ai:fetch-smoke
//   (node --env-file=.env.local scripts/ai-fetch-smoke.mjs [--plain] [url]; pass a URL to read a page of your
//   choice; --plain uses web_fetch_20250910, the version WITHOUT code-execution dynamic filtering)
//
// Verifies the ONE unverified assumption behind /api/content/references: that
// Anthropic's provider-executed `web_fetch` tool is forwarded by the Vercel AI
// Gateway and coexists with `Output.object` in one generateText call — i.e. the
// model actually FETCHES the page (a web_fetch tool call in the steps) and THEN
// returns one schema-valid object, instead of answering from memory or erroring
// on the tool. Mirrors `aiFetch()` in lib/ai/research.ts: same tool version,
// domain lock, content cap and effort.
//
// Makes one tiny real (paid) call. Dev tool only.

import { gateway, generateText, Output, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

const MODEL = 'anthropic/claude-sonnet-5'
const ARGS = process.argv.slice(2)
// --plain: web_fetch_20250910 drops the page text straight into context (capped by
// maxContentTokens). The default 20260209 tool runs code execution to filter the page
// first — fewer context tokens for a huge document, more for an ordinary page.
const PLAIN = ARGS.includes('--plain')
const URL_TO_READ = ARGS.find((a) => !a.startsWith('--')) ?? 'https://www.cpsc.gov/Recalls'
const TOOL_NAME = PLAIN ? 'web_fetch_20250910 (plain)' : 'web_fetch_20260209 (dynamic filtering)'

const schema = z.object({
  reachable: z.boolean(),
  title: z.string().nullable(),
  facts: z.array(z.string()).describe('up to 5 short facts the page states'),
})

async function main() {
  console.log(`\n=== url-read smoke: ${MODEL} + ${TOOL_NAME} + Output.object ===\nreading ${URL_TO_READ}\n`)

  let result
  try {
    result = await generateText({
      model: gateway(MODEL),
      tools: {
        web_fetch: (PLAIN ? anthropic.tools.webFetch_20250910 : anthropic.tools.webFetch_20260209)({
          maxUses: 1,
          allowedDomains: [new URL(URL_TO_READ).hostname],
          maxContentTokens: 20_000,
          citations: { enabled: false },
        }),
      },
      output: Output.object({ schema }),
      stopWhen: stepCountIs(3),
      system: [
        {
          role: 'system',
          content:
            'You read ONE web page the user names and return only facts it actually states. You MUST fetch the page before answering; never answer from memory. If the page cannot be fetched, return reachable=false and no facts.',
          providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
        },
      ],
      prompt: `Page to read: ${URL_TO_READ}\nFetch it and return up to 5 facts it states.`,
      maxOutputTokens: 6000,
      temperature: 0,
      providerOptions: { gateway: { tags: ['surface:ai-fetch-smoke'] }, anthropic: { effort: 'low' } },
    })
  } catch (err) {
    console.error('FAIL: generateText threw —', err?.name, err?.message ?? err)
    if (err?.cause) console.error('  cause:', err.cause?.message ?? err.cause)
    process.exit(1)
  }

  const steps = result.steps ?? []
  const toolCallNames = steps.flatMap((s) => (s.toolCalls ?? []).map((c) => c.toolName))
  const fetchCalls = toolCallNames.filter((n) => n === 'web_fetch').length
  console.log(`steps: ${steps.length}`)
  console.log(`tool calls across steps: [${toolCallNames.join(', ') || '—'}]`)
  console.log(`web_fetch calls: ${fetchCalls}`)

  let object
  try {
    object = result.output
  } catch (err) {
    console.error(`\nresult.output threw — ${err?.name}: ${err?.message ?? err}`)
  }
  console.log(`\noutput object:`)
  console.log(JSON.stringify(object, null, 2))
  const u = result.totalUsage ?? result.usage ?? {}
  console.log(`\nfinishReason: ${result.finishReason} | tokens: ${u.totalTokens} (input ${u.inputTokens}, output ${u.outputTokens}) | ${TOOL_NAME}`)

  const facts = object?.facts ?? []
  const fetched = fetchCalls >= 1
  const hasObject = object?.reachable === true && facts.length > 0
  console.log('\n=== VERDICT ===')
  console.log(`  fetched (>=1 web_fetch call):   ${fetched ? 'YES' : 'NO'}`)
  console.log(`  returned facts from the page:   ${hasObject ? 'YES' : 'NO'}`)
  console.log(fetched && hasObject ? '\nPASS — web_fetch works through the gateway with Output.object.\n' : '\nFAIL — see above. If no web_fetch call happened, the gateway did not forward the tool.\n')
  process.exit(fetched && hasObject ? 0 : 1)
}

main()
