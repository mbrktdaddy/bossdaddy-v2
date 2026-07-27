// Thinking / effort probe — `npm run ai:probe-thinking`.
//
// Answers three questions the docs assert but our stack has never demonstrated:
//
//   1. Does Sonnet 5 run adaptive thinking BY DEFAULT through the Gateway when
//      we send no `thinking` provider option? (Sonnet 4.6 did not. If it does,
//      every content route's maxOutputTokens is now shared between thinking and
//      answer text — a truncation risk introduced by the registry bump.)
//   2. Do `thinking` and `effort` provider options actually reach Anthropic
//      through the Vercel AI Gateway, or are they silently dropped?
//   3. What does effort cost? (tokens + latency per level)
//
// Prints the raw usage object and finishReason for each config so the answers
// are read off the wire, not inferred.

import { gateway, generateText } from 'ai'

const MODEL = process.env.PROBE_MODEL ?? 'anthropic/claude-sonnet-5'

// A prompt that genuinely rewards reasoning — a model that thinks will spend
// visibly more tokens here than one that doesn't.
const PROMPT = `A dad has a 12x16 ft deck. Boards are 5.5 inches wide with a 1/8 inch gap.
Boards run the 16 ft direction. How many boards does he need, and how many 16 ft
boards should he buy allowing 10% waste? Show the final numbers only.`

function anthropicOpts(extra) {
  return { providerOptions: { anthropic: extra, gateway: { tags: ['surface:probe-thinking'] } } }
}

const CONFIGS = [
  { label: 'default (no thinking option)', opts: {} },
  { label: 'thinking: disabled', opts: { thinking: { type: 'disabled' } } },
  { label: 'thinking: adaptive', opts: { thinking: { type: 'adaptive' } } },
  { label: 'adaptive + effort low', opts: { thinking: { type: 'adaptive' }, effort: 'low' } },
  { label: 'adaptive + effort high', opts: { thinking: { type: 'adaptive' }, effort: 'high' } },
  { label: 'adaptive + effort max', opts: { thinking: { type: 'adaptive' }, effort: 'max' } },
]

// Deliberately tight — mirrors the tightest real content budgets
// (collection-intro 800, schedule-followup 600, seo-meta 400). If thinking eats
// the budget, this is where it shows up as finishReason 'length'.
const TIGHT = 700

async function run(label, extra, maxOutputTokens) {
  const started = Date.now()
  try {
    const res = await generateText({
      model: gateway(MODEL),
      prompt: PROMPT,
      maxOutputTokens,
      ...anthropicOpts(extra),
    })
    const ms = Date.now() - started
    const u = res.usage ?? {}
    console.log(`\n  ${label}  [maxOutputTokens=${maxOutputTokens}]`)
    console.log(`    finishReason: ${res.finishReason}   ${ms}ms`)
    console.log(`    usage: ${JSON.stringify(u)}`)
    if (res.providerMetadata?.anthropic) {
      console.log(`    providerMetadata.anthropic: ${JSON.stringify(res.providerMetadata.anthropic)}`)
    }
    const text = (res.text ?? '').replace(/\s+/g, ' ').trim()
    console.log(`    text(${text.length}): ${text.slice(0, 180)}${text.length > 180 ? '…' : ''}`)
    return { ok: true, finishReason: res.finishReason, usage: u, ms, textLen: text.length }
  } catch (err) {
    console.log(`\n  ${label}  [maxOutputTokens=${maxOutputTokens}]`)
    console.log(`    ERROR: ${err?.message ?? err}`)
    return { ok: false }
  }
}

async function main() {
  console.log(`model: ${MODEL}`)

  console.log(`\n${'='.repeat(70)}\nA. TIGHT BUDGET (${TIGHT}) — does thinking eat a small content budget?\n${'='.repeat(70)}`)
  const tight = []
  for (const c of CONFIGS.slice(0, 3)) tight.push([c.label, await run(c.label, c.opts, TIGHT)])

  console.log(`\n${'='.repeat(70)}\nB. GENEROUS BUDGET (8000) — effort cost curve\n${'='.repeat(70)}`)
  const wide = []
  for (const c of CONFIGS) wide.push([c.label, await run(c.label, c.opts, 8000)])

  console.log(`\n${'='.repeat(70)}\nVERDICT\n${'='.repeat(70)}`)

  const def = tight.find(([l]) => l.startsWith('default'))?.[1]
  const dis = tight.find(([l]) => l.startsWith('thinking: disabled'))?.[1]
  if (def?.ok && dis?.ok) {
    const defTot = def.usage.totalTokens ?? 0
    const disTot = dis.usage.totalTokens ?? 0
    console.log(`Q1 default-thinks?  default=${def.finishReason}/${defTot}tok  disabled=${dis.finishReason}/${disTot}tok`)
    console.log(`    → ${defTot > disTot * 1.3 ? 'YES — default spends materially more; thinking is on by default' : 'inconclusive/NO — default is close to disabled'}`)
    if (def.finishReason === 'length' && dis.finishReason !== 'length')
      console.log(`    ⚠ TRUNCATION CONFIRMED at ${TIGHT} tokens with default settings but not with thinking disabled`)
  }

  console.log(`\nQ2 do the options reach the provider? compare effort rows below:`)
  for (const [label, r] of wide) {
    if (r?.ok) console.log(`    ${label.padEnd(30)} ${String(r.usage.totalTokens ?? '?').padStart(6)}tok  ${String(r.ms).padStart(6)}ms  ${r.finishReason}`)
  }
  console.log(`    → if the effort rows differ in tokens/latency, the options are reaching Anthropic.`)
}

main()
