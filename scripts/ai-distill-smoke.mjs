// Brief-step smoke test — run with:
//   npm run ai:distill-smoke
//
// Exercises the distillation behind /api/content/distill without the route: the
// same system prompt, the same output shape, the same model and knobs (Sonnet 5,
// effort low, temperature 0.3) on a messy, dictated-looking review brief. Verdict:
// did it return clean facts whose every number appears in the notes (it must add
// nothing), gaps that are real gaps (not already answered), and the aside?
//
// Makes one small real (paid) call. Dev tool only.

import { gateway, generateText, Output } from 'ai'
import { z } from 'zod'

const MODEL = 'anthropic/claude-sonnet-5'

const schema = z.object({
  facts: z.array(z.string()),
  gaps: z.array(z.object({ question: z.string(), label: z.string(), why: z.string().nullable().optional() })),
  asides: z.array(z.string()).optional(),
})

// Mirrors DISTILL_SYSTEM in lib/content/pipeline/distill.ts.
const SYSTEM = `You are the editor preparing a writer's brief for a product-review and dad-life site. The author's notes are raw: dictated, pasted, out of order, mixed with asides.
Return three things.
1. facts — every firsthand fact in the notes as a clean, one-line, self-contained statement, keeping the author's own specifics (numbers, durations, names of things, what happened, what broke, who was there). Under 40 words each, in the author's own first person ("I paid about $50 at Harbor Freight"), never "he". Merge duplicates, fix dictation, keep the order of events. Never add anything the notes do not say — not a brand, a place or a name the notes leave out; never soften or round a specific. An instruction or an opinion about the piece is not a fact.
2. gaps — up to 6 questions a reader of THIS piece would expect answered that the notes do not answer: the specifics a writer would otherwise be tempted to invent (how long it was owned or used, what was paid, which model or year, who else used it, what happened next, how it ended, where). Each has a question (one line, plain, dad to dad), a label (a 2–5 word noun phrase that will prefix the answer, e.g. "Time owned", "Price paid"), and why (under 12 words). Ask nothing the notes already answer. For a discussion piece the gaps are about the author's own experience and position, never research.
3. asides — any instruction or wish found IN THE NOTES THEMSELVES (tone, structure, length, what to avoid) as short lines, so the writer sees them without mistaking them for facts. The brief's own fields (product, category, target rating) are not asides.`

const NOTES = `- How I used it: Built a backyard deck over 3 weekends, then the Odyssey brake job
- Testing duration: 1–3 months

ok so the ratchet skipped two teeth on the caliper bracket bolt on the odyssey, barked my knuckles, that was the second month. case latches both broke, lid wont stay shut, bungee cord now. 130 pieces three drives. paid like 50 bucks i think maybe 55 at harbor freight. the 1/4 drive stuff is fine honestly. make this one funny but dont dunk on harbor freight too hard. no torque wrench babying it i just send it. the deep sockets are the ones i use most`

const PROMPT = `Prepare the brief for a product review.

Product: Pittsburgh 130-Piece Socket Set
Category: garage
Author's target rating: 5/10 — tone, verdict and the pros/cons balance must all reflect this.

THE AUTHOR'S NOTES (raw, firsthand):
"""
${NOTES}
"""

Return the structured object: facts, gaps, asides.`

async function main() {
  console.log(`\n=== brief-step smoke: ${MODEL} + Output.object ===\n`)
  let result
  try {
    result = await generateText({
      model: gateway(MODEL),
      output: Output.object({ schema }),
      system: SYSTEM,
      prompt: PROMPT,
      maxOutputTokens: 4000,
      temperature: 0.3,
      providerOptions: { gateway: { tags: ['surface:ai-distill-smoke'] }, anthropic: { effort: 'low' } },
    })
  } catch (err) {
    console.error('FAIL: generateText threw —', err?.name, err?.message ?? err)
    if (err?.cause) console.error('  cause:', err.cause?.message ?? err.cause)
    if (typeof err?.text === 'string') console.error('  raw:', err.text.slice(0, 400))
    process.exit(1)
  }
  const o = result.output
  console.log(JSON.stringify(o, null, 2))
  const u = result.totalUsage ?? result.usage ?? {}
  console.log(`\nfinishReason: ${result.finishReason} | tokens: ${u.totalTokens} (input ${u.inputTokens}, output ${u.outputTokens})`)

  // Every number in a fact must appear in the notes — the distill may add nothing.
  const numbers = (s) => (s.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]$/, ''))
  const invented = (o?.facts ?? []).filter((f) => numbers(f).some((n) => !NOTES.includes(n)))
  // Already answered in the notes: what was paid, how long it was tested. ("Would you buy it again" is a real gap.)
  const answered = (o?.gaps ?? []).filter((g) => /how much (did|do) you pa|what did you pay|how long (have|did|do) you/i.test(g.question))
  console.log('\n=== VERDICT ===')
  console.log(`  facts returned:                   ${o?.facts?.length ?? 0}`)
  console.log(`  facts with a number not in notes: ${invented.length}${invented.length ? '\n    ' + invented.join('\n    ') : ''}`)
  console.log(`  gaps returned (≤6):               ${o?.gaps?.length ?? 0}`)
  console.log(`  gaps the notes already answer:    ${answered.length}${answered.length ? '\n    ' + answered.map((g) => g.question).join('\n    ') : ''}`)
  console.log(`  asides (expect the tone wish):    ${(o?.asides ?? []).length}`)
  const pass = (o?.facts?.length ?? 0) > 0 && invented.length === 0 && (o?.gaps?.length ?? 0) <= 6 && answered.length === 0
  console.log(pass ? '\nPASS — grounded facts, real gaps, the aside kept apart.\n' : '\nFAIL — see above.\n')
  process.exit(pass ? 0 : 1)
}

main()
