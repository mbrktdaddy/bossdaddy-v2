import type Anthropic from '@anthropic-ai/sdk'
import { createStructured } from '@/lib/claude/structured'

// Merch Studio — saying generation.
//
// This is NOT the long-form article voice (lib/claude/client.ts BOSS_DADDY_SYSTEM).
// Merch copy is short, punchy, and wearable — a line someone puts on a chest or a
// mug, not a paragraph. So we use a dedicated, tighter system prompt here. The
// operator is the editor: Claude proposes, a human approves/edits/rejects each one
// before anything becomes a design (see /dashboard/admin/merch/studio).

export interface MerchSaying {
  text: string          // the main line — the thing printed big
  subline: string       // optional smaller supporting line ('' if none)
  angle: string         // one line on why it works / who it's for (editorial note)
  best_for: string      // 'tee' | 'hat' | 'mug' | 'any'
  ip_risk: 'none' | 'low' | 'review'
  ip_note: string       // why it was flagged ('' when ip_risk === 'none')
}

const MERCH_SAYINGS_SYSTEM = `You write short, wearable merch copy for Boss Daddy (BossDaddyLife.com) — the brand for men who Dad like a Boss. These lines go on t-shirts, hats, and coffee mugs, so they must be SHORT, punchy, and instantly readable across a room.

VOICE: Confident, no-BS dad — the older, wiser brother. Tough-loving humor with a playfully cynical edge toward soft culture and weak excuses. Grounded in faith, family, and brotherhood — never preachy. Proud-dad energy.

MERCH COPY RULES:
- Keep the main line tight: aim for 2–6 words, hard max ~40 characters. A tee slogan, not a sentence.
- Punchy, meme-able, and true to the archetype. It should make a dad grin or nod.
- "Dad", "Boss Daddy", "the good stuff", "boss stuff" are on-brand vocabulary.
- Faith/family angles welcome when natural — warm, never preachy.
- One idea per design. No run-ons, no explanation baked into the line.
- Sublines are OPTIONAL and usually empty — only add one if it lands a real punchline or clarifies. Never pad.

NEVER:
- Hype phrases: "game-changer", "next-level", "must-have", "legendary" (as filler).
- Group nicknames for the audience ("fellow bosses", "boss dads", "dad gang"). Speak to one man.
- Anything that mocks or jokes about loss, grief, mental health, marriage strain, or child safety. Those topics are off-limits for merch humor entirely — skip them, don't soften them.
- Profanity beyond mild (a "hell"/"damn" is fine; nothing stronger).

INTELLECTUAL PROPERTY GUARDRAIL (critical — this goes on physical product for sale):
- Do NOT reproduce trademarked slogans, brand catchphrases, song lyrics, movie/TV quotes, or another company's tagline.
- Common English idioms and generic dad humor are fine and encouraged.
- If a line is even slightly reminiscent of a famous/trademarked phrase, set ip_risk to "low" or "review" and explain in ip_note. When unsure, flag it — the operator makes the final call.
- Original lines you invented get ip_risk "none".

OUTPUT: Call the tool with your candidates. Nothing else.`

const SAYINGS_TOOL: Anthropic.Tool = {
  name: 'propose_merch_sayings',
  description: 'Return the batch of candidate merch sayings for operator review.',
  input_schema: {
    type: 'object',
    properties: {
      sayings: {
        type: 'array',
        description: 'The candidate sayings, best first.',
        items: {
          type: 'object',
          properties: {
            text:    { type: 'string', description: 'The main printed line. 2–6 words, ~40 chars max.' },
            subline: { type: 'string', description: 'Optional smaller supporting line. Empty string if none.' },
            angle:   { type: 'string', description: 'One line: why it works / who it is for. Editorial note for the operator.' },
            best_for: { type: 'string', enum: ['tee', 'hat', 'mug', 'any'], description: 'Which blank this line fits best.' },
            ip_risk: { type: 'string', enum: ['none', 'low', 'review'], description: 'Trademark/copyright resemblance risk.' },
            ip_note: { type: 'string', description: 'Why it was flagged. Empty string when ip_risk is none.' },
          },
          required: ['text', 'subline', 'angle', 'best_for', 'ip_risk', 'ip_note'],
          additionalProperties: false,
        },
      },
    },
    required: ['sayings'],
    additionalProperties: false,
  },
}

export async function generateMerchSayings(opts: {
  theme: string
  count?: number
}): Promise<MerchSaying[]> {
  const count = Math.min(Math.max(opts.count ?? 8, 1), 20)
  const userPrompt = `Theme / direction: ${opts.theme.trim()}

Give me ${count} distinct candidate sayings for Boss Daddy merch on this theme. Vary the angle across the batch (proud-dad, tough-love humor, faith/family, everyday-dad-life). Best ones first.`

  const { data } = await createStructured({
    system: [{ type: 'text', text: MERCH_SAYINGS_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPrompt }],
    tool: SAYINGS_TOOL,
    maxTokens: 2000,
    // Merch copy wants punch + variety across the batch, so run hotter than the
    // long-form default (0.8). Still bounded by the tool schema + banlist.
    temperature: 1.0,
  })

  const raw = (data?.sayings as unknown[]) ?? []
  return raw
    .map((s): MerchSaying | null => {
      const o = s as Record<string, unknown>
      const text = typeof o.text === 'string' ? o.text.trim() : ''
      if (!text) return null
      const ipRisk = o.ip_risk === 'low' || o.ip_risk === 'review' ? o.ip_risk : 'none'
      const bestFor = ['tee', 'hat', 'mug', 'any'].includes(o.best_for as string) ? (o.best_for as string) : 'any'
      return {
        text,
        subline: typeof o.subline === 'string' ? o.subline.trim() : '',
        angle:   typeof o.angle === 'string' ? o.angle.trim() : '',
        best_for: bestFor,
        ip_risk: ipRisk,
        ip_note: typeof o.ip_note === 'string' ? o.ip_note.trim() : '',
      }
    })
    .filter((s): s is MerchSaying => s !== null)
}
