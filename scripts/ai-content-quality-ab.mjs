// Content-quality configuration sweep — `npm run ai:ab-content`.
//
// Sizes the `content` bucket for a QUALITY-FIRST goal (public-facing published
// copy), and produces the numbers needed to fix the output-budget regression the
// Sonnet 5 bump introduced.
//
// WHY THIS EXISTS: Sonnet 5 runs adaptive thinking by DEFAULT (verified via
// `npm run ai:probe-thinking`), and thinking tokens share the `maxOutputTokens`
// pool with the answer text. Sonnet 5 also tokenizes ~30% heavier than 4.6. Both
// shrink the article that actually reaches the page. This measures the real
// reasoning-vs-text split per config so budgets can be sized from data.
//
// Covers both long-form surfaces, since they have different schemas and budgets:
//   • review draft  (app/api/claude/draft)        — maxOutputTokens 8000
//   • guide draft   (app/api/claude/guide-draft)  — maxOutputTokens 8000 ('guide')
//
// CAVEAT: the voice system prompt here is a representative stand-in, not the real
// buildBossDaddySystemMessages() output (that needs Supabase + a user row). System
// size affects INPUT tokens only, so it does not distort the output-budget finding
// this script exists to measure. Judge voice from the sampled prose, not from
// fidelity to prod's system blocks.
//
// Makes real (paid) calls on long generations — expect a few dollars. Dev tool only.

import { writeFileSync } from 'node:fs'
import { gateway, generateObject, jsonSchema } from 'ai'

// $ per 1M tokens, Anthropic list price. Sonnet 5 carries a lower intro rate
// ($2/$10) through 2026-08-31; list is used here so the comparison stays valid
// after it expires.
const PRICING = {
  'anthropic/claude-sonnet-5': { in: 3, out: 15 },
  'anthropic/claude-opus-5': { in: 5, out: 25 },
}

const CONFIGS = [
  { model: 'anthropic/claude-sonnet-5', effort: 'high', label: 'sonnet-5 / high' },
  { model: 'anthropic/claude-sonnet-5', effort: 'xhigh', label: 'sonnet-5 / xhigh' },
  { model: 'anthropic/claude-opus-5', effort: 'high', label: 'opus-5   / high' },
  { model: 'anthropic/claude-opus-5', effort: 'xhigh', label: 'opus-5   / xhigh' },
]

// Deliberately the CURRENT production budget, so truncation and shrinkage show up
// exactly as they would on master today.
const CURRENT_BUDGET = 8000

const VOICE_SYSTEM = `You are Boss Daddy — an older, wiser brother voice for dads.
Archetype: Wise Warrior / Protector King. Tough-loving humor, playfully cynical toward
mediocrity, warm and present with dads who are struggling. Grounded in faith without preaching.

Rules:
- First-person dad voice with real-testing specifics ("I used this for three weekends...").
- Confident and direct. No corporate speak, no hype phrases, no "game-changer"/"elevate".
- Never invent a spec or a number you were not given.
- Edge OFF for safety, loss, and vulnerability topics.
- Write like a man talking to another man he respects, not like marketing copy.`

// ── review draft: real DRAFT_SCHEMA from app/api/claude/draft/route.ts ──
const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' }, excerpt: { type: 'string' }, tldr: { type: 'string' },
    keyTakeaways: { type: 'array', items: { type: 'string' } },
    bestFor: { type: 'array', items: { type: 'string' } },
    notFor: { type: 'array', items: { type: 'string' } },
    faqs: { type: 'array', items: { type: 'object',
      properties: { question: { type: 'string' }, answer: { type: 'string' } },
      required: ['question', 'answer'] } },
    subScores: { type: 'object', properties: {
      quality: { type: 'integer' }, value: { type: 'integer' },
      ease: { type: 'integer' }, dailyUse: { type: 'integer' },
    }, required: ['quality', 'value', 'ease', 'dailyUse'] },
    wouldRebuy: { type: 'boolean' },
    introduction: { type: 'string' },
    sections: { type: 'array', items: { type: 'object',
      properties: { heading: { type: 'string' }, body: { type: 'string' } },
      required: ['heading', 'body'] } },
    verdict: { type: 'string' },
    pros: { type: 'array', items: { type: 'string' } },
    cons: { type: 'array', items: { type: 'string' } },
    imagePrompt: { type: 'string' },
    suggestedTags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'excerpt', 'tldr', 'keyTakeaways', 'bestFor', 'notFor', 'faqs',
    'subScores', 'wouldRebuy', 'introduction', 'sections', 'verdict', 'pros', 'cons',
    'imagePrompt', 'suggestedTags'],
}

// Structure requirements copied from the real route — these drive output length,
// which is the whole point of the measurement.
const DRAFT_PROMPT = `Write a product review:

Product: Battery Daddy Storage & Organizer
Brand: Ontel
Category: Garage & Workshop
Key Features: holds 180 batteries, removable battery tester, clear lid, double-sided case

AUTHOR EXPERIENCE (ground truth — write the review as if you lived this):
- Used it for four months in a cluttered two-car garage.
- Replaced three coffee cans and a junk drawer of loose batteries.
- The tester saved throwing out a dozen still-good AAs.
- Latches feel cheap; one popped open when carried by the handle.
- Doesn't hold 9V blocks as neatly as advertised.

STRUCTURE REQUIREMENTS:
- Introduction: 2–3 sentences that open with a real testing scenario (first-person dad)
- Sections: 3–5 sections, each 150–250 words covering different aspects (performance, design, value, family use)
- Separate paragraphs within each section with \\n\\n
- Verdict: 1–2 paragraphs with a clear buy/skip recommendation
- Pros: 3–6 short, specific items (not vague — "held 180 cells across 4 sizes" not "lots of storage")
- Cons: 2–4 honest, specific items — never skip the cons

CONTENT BLOCKS (required — these render as structured UI elements, not prose):
- tldr: 1–2 sentence verdict for skimmers. Lead with the gut answer.
- keyTakeaways: 3–5 specific, decision-relevant bullets. Not a rehash of pros.
- bestFor: 3–4 specific buyer profiles.
- notFor: 2–3 specific situations or buyer types who should skip.
- faqs: 3–5 Q&A pairs, answers 2–3 sentences each, phrased the way a dad would search.
- subScores: four 1–10 integers that DEFEND a target overall of 7/10 and average to ~7.0.
- wouldRebuy: boolean.

SEO: Include the product name naturally in the intro and at least one section heading.
TAGS: pick 3–6 from: garage, organization, budget-pick, everyday-carry, toddler-dad, tools.

Field guidance: title is an SEO title including the product name (max 70 chars); excerpt is one punchy card sentence (max 160 chars); section bodies are 150–250 words with paragraphs separated by \\n\\n.`

// ── guide draft: real schema shape for pieceType 'guide' ──
const GUIDE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' }, excerpt: { type: 'string' },
    introduction: { type: 'string' },
    sections: { type: 'array', items: { type: 'object',
      properties: { heading: { type: 'string' }, body: { type: 'string' } },
      required: ['heading', 'body'] } },
    conclusion: { type: 'string' },
    heroImagePrompt: { type: 'string' },
    tldr: { type: 'string' },
    keyTakeaways: { type: 'array', items: { type: 'string' } },
    faqs: { type: 'array', items: { type: 'object',
      properties: { question: { type: 'string' }, answer: { type: 'string' } },
      required: ['question', 'answer'] } },
    suggestedTags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'excerpt', 'introduction', 'sections', 'conclusion',
    'heroImagePrompt', 'tldr', 'keyTakeaways', 'faqs', 'suggestedTags'],
}

const GUIDE_PROMPT = `Write a dad-focused guide on this topic:

Topic: Getting a garage actually usable again after years of it being the family dumping ground
Category: Garage & Workshop
Key Points: triage before storage, zones over shelves, the one-in-one-out rule, what to spend on vs skip
Target Audience: dads with young kids and no weekends

STRUCTURE:
- Introduction: 2–3 paragraphs setting the real problem, first-person
- Sections: 4–6 sections, each 200–300 words, each solving one concrete piece of the problem
- Separate paragraphs within each section with \\n\\n
- Conclusion: 2 paragraphs, honest about what this does and does not fix

CONTENT BLOCKS (required):
- tldr: 1–2 sentence answer for skimmers
- keyTakeaways: 3–5 specific, useful bullets
- faqs: 3–5 Q&A pairs, answers 2–3 sentences each

SEO: Include the main topic phrase naturally in the intro and at least one section heading.
TAGS: pick 3–6 from: garage, organization, weekend-project, toddler-dad, budget-pick, tools.

Field guidance: title is specific and useful (max 80 chars); excerpt is one punchy card sentence (max 160 chars); section bodies are 200–300 words with paragraphs separated by \\n\\n.`

const SURFACES = [
  { name: 'review draft', schema: DRAFT_SCHEMA, prompt: DRAFT_PROMPT, budget: CURRENT_BUDGET },
  { name: 'guide draft', schema: GUIDE_SCHEMA, prompt: GUIDE_PROMPT, budget: CURRENT_BUDGET },
]

// Prose that actually reaches the published page — the number that matters.
function proseWordCount(obj) {
  const parts = []
  const push = (v) => { if (typeof v === 'string') parts.push(v) }
  push(obj.introduction); push(obj.verdict); push(obj.conclusion); push(obj.tldr); push(obj.excerpt)
  for (const s of obj.sections ?? []) { push(s.heading); push(s.body) }
  for (const f of obj.faqs ?? []) { push(f.question); push(f.answer) }
  for (const k of ['keyTakeaways', 'bestFor', 'notFor', 'pros', 'cons']) {
    for (const v of obj[k] ?? []) push(v)
  }
  return parts.join(' ').split(/\s+/).filter(Boolean).length
}

function cost(model, usage) {
  const p = PRICING[model]
  if (!p) return null
  return ((usage.inputTokens ?? 0) / 1e6) * p.in + ((usage.outputTokens ?? 0) / 1e6) * p.out
}

async function runOne(surface, cfg) {
  const started = Date.now()
  try {
    const res = await generateObject({
      model: gateway(cfg.model),
      schema: jsonSchema(surface.schema),
      system: [{
        role: 'system',
        content: VOICE_SYSTEM,
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      }],
      prompt: surface.prompt,
      maxOutputTokens: surface.budget,
      temperature: 0.8,
      providerOptions: {
        anthropic: { thinking: { type: 'adaptive' }, effort: cfg.effort },
        gateway: { tags: ['surface:ab-content'] },
      },
    })
    const u = res.usage ?? {}
    const reasoning = u.outputTokenDetails?.reasoningTokens ?? u.reasoningTokens ?? 0
    const textTok = u.outputTokenDetails?.textTokens ?? ((u.outputTokens ?? 0) - reasoning)
    return {
      ok: true, ms: Date.now() - started, object: res.object,
      finishReason: res.finishReason,
      inputTokens: u.inputTokens ?? 0, outputTokens: u.outputTokens ?? 0,
      reasoning, textTok, words: proseWordCount(res.object),
      sections: (res.object.sections ?? []).length,
      usd: cost(cfg.model, u),
    }
  } catch (err) {
    return { ok: false, ms: Date.now() - started, error: err?.message ?? String(err) }
  }
}

async function main() {
  const samples = {}
  for (const surface of SURFACES) {
    console.log(`\n${'#'.repeat(76)}\n# ${surface.name.toUpperCase()}  —  maxOutputTokens ${surface.budget} (current prod value)\n${'#'.repeat(76)}`)
    console.log(`\n${'config'.padEnd(18)} ${'out'.padStart(6)} ${'think'.padStart(6)} ${'text'.padStart(6)} ${'%think'.padStart(7)} ${'words'.padStart(6)} ${'sec'.padStart(4)} ${'lat'.padStart(7)} ${'$'.padStart(7)}  finish`)
    console.log('-'.repeat(90))

    for (const cfg of CONFIGS) {
      const r = await runOne(surface, cfg)
      if (!r.ok) {
        console.log(`${cfg.label.padEnd(18)} FAILED (${Math.round(r.ms)}ms) — ${r.error}`)
        continue
      }
      const pct = r.outputTokens ? Math.round((r.reasoning / r.outputTokens) * 100) : 0
      const headroom = r.outputTokens / surface.budget
      const flag = r.finishReason === 'length' ? '  ⚠ TRUNCATED'
        : headroom > 0.9 ? '  ⚠ >90% of budget' : ''
      console.log(
        `${cfg.label.padEnd(18)} ${String(r.outputTokens).padStart(6)} ${String(r.reasoning).padStart(6)} ` +
        `${String(r.textTok).padStart(6)} ${String(pct + '%').padStart(7)} ${String(r.words).padStart(6)} ` +
        `${String(r.sections).padStart(4)} ${String(Math.round(r.ms) + 'ms').padStart(7)} ` +
        `${('$' + (r.usd ?? 0).toFixed(3)).padStart(7)}  ${r.finishReason}${flag}`,
      )
      samples[`${surface.name} — ${cfg.label}`] = r.object
    }
  }

  const out = 'ai-content-ab-samples.json'
  writeFileSync(out, JSON.stringify(samples, null, 2))
  console.log(`\nFull drafts written to ${out} — read the prose to judge VOICE; the table above only measures budget and cost.`)
  console.log(`\nSizing rule: new maxOutputTokens ≈ (text tokens needed) + (reasoning tokens observed) + ~25% margin.`)
}

main()
