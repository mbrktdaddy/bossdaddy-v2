// "Research this part" smoke test — run with:
//   npm run ai:research-part-smoke
//
// Exercises the search behind /api/content/runs/[id]/research without a run: the
// same system prompt and output shape, Anthropic's plain web search with the
// retailer domains excluded (the route goes through aiResearch, which dispatches
// to Grok Live Search instead when AI_MODEL_RESEARCH is an xai slug). Verdict:
// did it actually search, and are the findings facts with a real non-retailer
// address each?
//
// Makes a few small real (paid) web-search calls. Dev tool only.

import { gateway, generateText, Output, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

const MODEL = 'anthropic/claude-sonnet-5'
const BLOCKED = ['amazon.com', 'amazon.ca', 'amazon.co.uk', 'amzn.to', 'a.co', 'homedepot.com', 'lowes.com', 'walmart.com', 'target.com', 'bestbuy.com', 'ebay.com', 'zoro.com', 'grainger.com', 'acmetools.com', 'toolnut.com', 'northerntool.com', 'harborfreight.com', 'menards.com', 'acehardware.com', 'cpooutlets.com', 'ohiopowertool.com']

const schema = z.object({
  findings: z.array(z.object({
    fact: z.string(),
    sourceTitle: z.string().nullable().optional(),
    sourceUrl: z.string(),
  })),
})

// Mirrors RESEARCH_SYSTEM in lib/content/pipeline/research.ts.
const SYSTEM = `You are a research assistant for a product-review and dad-life site. Find the few verifiable facts a reader would want in ONE section of a piece.
- Search the web. Use only facts you actually retrieved, each with the address of the page it came from. Never answer from memory.
- Prefer the maker, government agencies, standards bodies, universities and major publications. Never a retailer product page, never a forum.
- Each fact is one line under 30 words with its number, date or name; no opinions, no marketing language, nothing inferred.
- 3–6 facts. If nothing solid turns up, return an empty list.`

const PROMPT = `Research ONE section of a product review about DeWalt DCD791 20V MAX XR brushless drill/driver.

Section: "Battery life across a weekend"
What the section must do: tell a dad what to expect from the 2.0Ah battery on real jobs and how long a charge takes.

Search the web and return 3–6 verifiable facts a reader of this section would want, each with the address of its page. Return the structured object.`

async function main() {
  console.log(`\n=== research-part smoke: ${MODEL} + web_search (plain, retailers excluded) + Output.object ===\n`)
  let result
  try {
    result = await generateText({
      model: gateway(MODEL),
      tools: { web_search: anthropic.tools.webSearch_20250305({ maxUses: 4, blockedDomains: BLOCKED }) },
      output: Output.object({ schema }),
      stopWhen: stepCountIs(6),
      system: SYSTEM,
      prompt: PROMPT,
      maxOutputTokens: 3000,
      temperature: 0,
      providerOptions: { gateway: { tags: ['surface:ai-research-part-smoke'] } },
    })
  } catch (err) {
    console.error('FAIL: generateText threw —', err?.name, err?.message ?? err)
    if (err?.cause) console.error('  cause:', err.cause?.message ?? err.cause)
    process.exit(1)
  }
  const steps = result.steps ?? []
  const searches = steps.flatMap((s) => (s.toolCalls ?? []).map((c) => c.toolName)).filter((n) => n === 'web_search').length
  let o
  try { o = result.output } catch (err) { console.error(`result.output threw — ${err?.message ?? err}`) }
  console.log(JSON.stringify(o, null, 2))
  const u = result.totalUsage ?? result.usage ?? {}
  console.log(`\nsteps: ${steps.length} | web_search calls: ${searches} | finishReason: ${result.finishReason} | tokens: ${u.totalTokens}`)

  const findings = o?.findings ?? []
  const isWeb = (u) => { try { return /^https?:$/.test(new URL(u).protocol) } catch { return false } }
  const retailer = findings.filter((f) => { try { const h = new URL(f.sourceUrl).hostname.replace(/^www\./, ''); return BLOCKED.some((b) => h === b || h.endsWith('.' + b)) } catch { return false } })
  const bad = findings.filter((f) => !isWeb(f.sourceUrl))
  console.log('\n=== VERDICT ===')
  console.log(`  searched (>=1 web_search call): ${searches >= 1 ? 'YES' : 'NO'}`)
  console.log(`  findings:                       ${findings.length}`)
  console.log(`  findings with a bad address:    ${bad.length}`)
  console.log(`  findings from a retailer:       ${retailer.length}`)
  const pass = searches >= 1 && findings.length > 0 && bad.length === 0 && retailer.length === 0
  console.log(pass ? '\nPASS — searched, sourced, no retailer.\n' : '\nFAIL — see above.\n')
  process.exit(pass ? 0 : 1)
}

main()
