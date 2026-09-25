// xAI search-tools smoke test — `node --env-file=.env.local scripts/xai-search-smoke.mjs`.
// Settles whether the AI Gateway executes xAI's server-side web_search AND
// x_search tools (Vercel only documents web_search). One small paid call.
// Dev tool only — not imported by the app.

import { gateway, streamText } from 'ai'
import { xai } from '@ai-sdk/xai'

// `--x-only` attaches ONLY x_search, to tell "Gateway drops it" from "model skipped it".
const X_ONLY = process.argv.includes('--x-only')
const MODEL = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'xai/grok-4.5'

async function main() {
  const counts = {}
  const toolCalls = []
  const sources = []
  let text = ''

  const result = streamText({
    model: gateway(MODEL),
    prompt: X_ONLY
      ? `Today is ${new Date().toISOString().slice(0, 10)}. Search X for posts from the last day about the ` +
        'US-China state visit and quote two real posts with their authors. Keep it to 4 sentences.'
      : `Today is ${new Date().toISOString().slice(0, 10)}. What is one big news story today, ` +
        'and what are people on X saying about it? Use web search AND X search. Keep it to 4 sentences.',
    tools: X_ONLY
      ? { x_search: xai.tools.xSearch() }
      : { web_search: xai.tools.webSearch(), x_search: xai.tools.xSearch() },
    providerOptions: { gateway: { tags: ['surface:xai-search-smoke'] } },
  })

  for await (const part of result.fullStream) {
    counts[part.type] = (counts[part.type] ?? 0) + 1
    if (part.type === 'tool-call') toolCalls.push(`${part.toolName} (providerExecuted=${part.providerExecuted})`)
    if (part.type === 'tool-result') console.log(`tool-result ${part.toolName}:`, JSON.stringify(part.output)?.slice(0, 300))
    if (part.type === 'source') sources.push(part.url ?? part.title ?? JSON.stringify(part).slice(0, 120))
    if (part.type === 'text-delta') text += part.text
    if (part.type === 'error') console.error('STREAM ERROR:', part.error?.message ?? part.error)
  }

  console.log(`model: ${MODEL}`)
  console.log('stream part counts:', counts)
  console.log('tool calls:', toolCalls.length ? toolCalls : 'NONE')
  console.log(`sources (${sources.length}):`, sources.slice(0, 8))
  console.log('usage:', await result.usage)
  console.log('provider metadata:', JSON.stringify(await result.providerMetadata)?.slice(0, 600))
  console.log('\n--- answer ---\n' + text.slice(0, 1200))
}

main().catch((err) => {
  console.error('FAIL:', err?.message ?? err)
  process.exit(1)
})
