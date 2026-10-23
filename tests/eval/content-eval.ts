import { afterAll, describe, it, expect } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { aiGenerateObjectWithMeta, aiGenerateTextWithMeta } from '@/lib/ai/client'
import { MODELS } from '@/lib/ai/models'
import { buildBossDaddySystemMessages, getVoiceProfile, voiceProfileFactLines } from '@/lib/voiceProfile'
import { fetchTagVocabulary } from '@/lib/claude/tag-vocab'
import { PROMPT_VERSION, validateSuggestedTags } from '@/lib/content/prompts'
import { BriefInput, normalizeBrief } from '@/lib/content/pipeline/briefs'
import { OutlineOutput, buildOutline, outlinePrompt, validateOutlineShape, type OutlineModelOutput } from '@/lib/content/pipeline/outline'
import { findRelated } from '@/lib/content/pipeline/related'
import { sectionBudget, sectionPrompt } from '@/lib/content/pipeline/section'
import { blocksOutput, blocksPrompt } from '@/lib/content/pipeline/blocks'
import { runRules } from '@/lib/content/pipeline/critic/rules'
import { CRITIC_SYSTEM, CriticOutput, blocksText, criticPrompt, type CriticModelOutput } from '@/lib/content/pipeline/critic/model'
import type { Blocks, Brief, CriticFinding, RunState } from '@/lib/content/pipeline/types'

// ── CONTENT GOLDEN EVAL ──────────────────────────────────────────────────────
// Runs the staged pipeline (outline → sections → blocks → critic) on six fixed
// briefs IN MEMORY — the same prompt builders, schemas, models, efforts and
// temperatures as app/api/content/runs/*, but no content_runs row, no
// `generations` row, no rate limit, no HTTP. The judge is the pipeline's own
// critic (rules + the editor model at temperature 0) plus a few objective
// checks, so a prompt-version or model bump is measured by the editor the
// author already trusts.
//
// Run: `npm run content:eval` BEFORE any change to lib/content/prompts.ts,
// lib/content/pipeline/*, lib/ai/models.ts pins or the content bucket's
// resolveModel. Makes real (paid) calls: six long pieces at effort `high` —
// expect a few dollars. The cost per piece is printed; the dashboard's
// "Readers finishing, by prompt version" card is the live outcome signal that
// closes the loop once a version has been read.
//
// Voice comes from the author's real profile + exemplars: set
// CONTENT_EVAL_USER_ID to a profile id, else the first admin profile is used.
// ────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const HAS_MODEL_KEY = !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN)
const READY = !!(SUPABASE_URL && SERVICE_KEY && HAS_MODEL_KEY)

// ── Thresholds — tighten as the prompt matures, never loosen to pass ─────────
const MAX_BLOCK_FINDINGS = 0
const MAX_WARN_FINDINGS = 3
/** A part under half its target is a thin section, whatever the critic says. */
const MIN_LENGTH_RATIO = 0.5
const MIN_PROS = 3
const MIN_CONS = 2
const PER_PIECE_TIMEOUT_MS = 10 * 60 * 1000

const EMOJI = /\p{Extended_Pictographic}/u
const MD_HEADING = /^\s{0,3}#{1,6}\s/m
const MD_BOLD = /\*\*[^*]+\*\*/

// ── The golden briefs (3 reviews, 3 guides incl. one inquiry) ────────────────
// Real-shaped notes: the critic's FTC check only works against facts on record.
const BRIEFS: { label: string; input: unknown }[] = [
  {
    label: 'review/organizer (7/10, four months of notes)',
    input: {
      contentType: 'review', productName: 'Battery Daddy Storage & Organizer', brand: 'Ontel', category: 'tools-diy',
      keyFeatures: ['holds 180 batteries', 'removable battery tester', 'clear lid', 'double-sided case'],
      specs: [{ label: 'Capacity', value: '180 batteries' }, { label: 'Tester', value: 'removable, AA/AAA/9V/C/D' }],
      competitors: [], imageSlots: 0, ratingHint: 7, testingDuration: '3+mo', pricePaid: 2499,
      howYouUsedIt: 'Four months in a cluttered two-car garage. Replaced three coffee cans and a junk drawer of loose batteries.',
      standoutMoment: 'The tester saved throwing out a dozen still-good AAs. Latches feel cheap; one popped open when carried by the handle. Does not hold 9V blocks as neatly as advertised.',
    },
  },
  {
    label: 'review/stroller (8/10, a year in)',
    input: {
      contentType: 'review', productName: 'Graco Modes Nest Travel System', brand: 'Graco', category: 'kids-family',
      keyFeatures: ['reversible seat', 'infant car seat clicks in', 'one-hand fold', 'large basket'],
      specs: [{ label: 'Weight', value: '27.5 lb' }, { label: 'Fold', value: 'one-hand, self-standing' }],
      competitors: [], imageSlots: 0, ratingHint: 8, testingDuration: '1yr', pricePaid: 37999,
      howYouUsedIt: 'Daily since our first came home — grocery runs, the zoo twice, airport once (gate-checked, came back scuffed but fine).',
      standoutMoment: 'The one-hand fold is real: I have folded it holding a sleeping baby. The basket is big but the rear bar makes it awkward to load a diaper bag. Front wheels chatter on brick sidewalks.',
    },
  },
  {
    label: 'review/socket set (5/10, honest middling verdict)',
    input: {
      contentType: 'review', productName: 'Pittsburgh 130-Piece Socket Set', brand: 'Harbor Freight', category: 'vehicles-garage',
      keyFeatures: ['130 pieces', 'SAE and metric', '1/4, 3/8, 1/2 drives', 'blow-molded case'],
      specs: [{ label: 'Pieces', value: '130' }, { label: 'Drives', value: '1/4", 3/8", 1/2"' }],
      competitors: [], imageSlots: 0, ratingHint: 5, testingDuration: '6mo', pricePaid: 8999,
      howYouUsedIt: 'Six months: brake job on a 2014 Odyssey, a deck build, and the usual around-the-house bolts.',
      standoutMoment: 'The 3/8 ratchet skipped teeth under real torque on a caliper bolt. Sockets are fine. The case latches broke in month two and the lid no longer stays shut.',
    },
  },
  {
    label: 'guide/howto (drywall, no product links)',
    input: {
      contentType: 'guide', topic: 'How to patch a drywall hole before the landlord inspection', category: 'tools-diy', pieceType: 'howto',
      keyPoints: ['doorknob-sized holes need a patch, not just compound', 'three thin coats beat one thick one', 'prime before paint or the patch flashes through', 'match the texture or it will show'],
      context: 'I have done this four times across two rentals. The first one flashed through the paint because I skipped primer.',
      targetAudience: 'renters with a deposit on the line', productSlugs: [], imageSlots: 0, inquiryMode: false,
    },
  },
  {
    label: 'guide/guide (toddler camping)',
    input: {
      contentType: 'guide', topic: 'Your first camping trip with a toddler', category: 'outdoors-adventure', pieceType: 'guide',
      keyPoints: ['one night, under an hour from home, the first time', 'bring the exact bedtime routine from home', 'a headlamp for the kid is the best five dollars you will spend', 'plan for the 5am wake-up'],
      context: 'Two trips so far — the first was one night at a state park 40 minutes out. The 5am wake-up was the only real surprise.',
      targetAudience: 'dads of 2–4 year olds', productSlugs: [], imageSlots: 0, inquiryMode: false,
    },
  },
  {
    label: 'guide/essay (inquiry register — quitting a sport)',
    input: {
      contentType: 'guide', topic: 'Should you let your kid quit a sport mid-season?', category: 'table-duty', pieceType: 'essay',
      keyPoints: ['the commitment argument: the team is counting on them', 'the misery argument: forcing it can kill the sport for good', 'what the kid is actually asking for underneath "I want to quit"', 'where I landed and why'],
      context: 'Our oldest wanted out of soccer in week four. We finished the season. He did not sign up again, and I still think it was right.',
      productSlugs: [], imageSlots: 0, inquiryMode: true,
    },
  },
]

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
}

async function resolveAuthor(supabase: SupabaseClient): Promise<string> {
  const fromEnv = process.env.CONTENT_EVAL_USER_ID
  if (fromEnv) return fromEnv
  const { data } = await supabase.from('profiles').select('id').eq('role', 'admin').order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!data?.id) throw new Error('content:eval — no admin profile found; set CONTENT_EVAL_USER_ID')
  return data.id
}

function baseRun(brief: Brief, userId: string): RunState {
  const now = new Date().toISOString()
  return {
    id: 'eval', userId, contentType: brief.contentType, status: 'outline', brief,
    outline: null, sections: [], blocks: null, critic: null, images: null,
    contentId: null, costUsd: 0, error: null, promptVersion: PROMPT_VERSION, createdAt: now, updatedAt: now,
  }
}

interface PieceResult {
  run: RunState
  findings: CriticFinding[]
  summary: string
  costUsd: number
  truncatedParts: number[]
}

/** Same stages, same knobs as app/api/content/runs/[id]/{outline,section,blocks,critic}. */
async function generate(brief: Brief, ctx: { supabase: SupabaseClient; userId: string }): Promise<PieceResult> {
  const { supabase, userId } = ctx
  const run = baseRun(brief, userId)
  const system = await buildBossDaddySystemMessages(supabase, userId)
  let costUsd = 0

  // Stage 1 — outline (Haiku, effort low, 0.7)
  const related = await findRelated(supabase, brief).catch(() => [])
  const outline = await aiGenerateObjectWithMeta<OutlineModelOutput>({
    bucket: 'content', model: MODELS.claudeHaiku, tag: 'eval-outline', schema: OutlineOutput, system,
    messages: [{ role: 'user', content: outlinePrompt(brief, related) }],
    maxOutputTokens: 2500, effort: 'low', temperature: 0.7, maxRetries: 2, promptVersion: PROMPT_VERSION,
  })
  costUsd += outline.meta.costUsd ?? 0
  const shapeErr = validateOutlineShape(outline.object.parts)
  expect(shapeErr, `outline shape: ${shapeErr}`).toBeNull()
  run.outline = buildOutline(outline.object, brief, related)
  run.sections = run.outline.parts.map(() => null)
  run.status = 'drafting'

  // Stage 2 — sections in order (Sonnet, effort high, 0.8), one-shot instead of streamed
  const truncatedParts: number[] = []
  for (let i = 0; i < run.outline.parts.length; i++) {
    const part = run.outline.parts[i]
    const { text, meta } = await aiGenerateTextWithMeta({
      bucket: 'content', tag: 'eval-section', system,
      messages: [{ role: 'user', content: sectionPrompt(run, i) }],
      maxOutputTokens: sectionBudget(part.targetWords), effort: 'high', temperature: 0.8, maxRetries: 2, promptVersion: PROMPT_VERSION,
    })
    costUsd += meta.costUsd ?? 0
    if (meta.finishReason === 'length') truncatedParts.push(i)
    run.sections[i] = { text: text.trim(), generationId: null }
  }
  run.status = 'blocks'

  // Stage 3 — blocks from the finished prose (effort low, 0.5)
  const vocab = await fetchTagVocabulary(supabase)
  const blocks = await aiGenerateObjectWithMeta<Blocks>({
    bucket: 'content', tag: 'eval-blocks', schema: blocksOutput(run.outline.blocks, brief.contentType), system,
    messages: [{ role: 'user', content: blocksPrompt(run, vocab) }],
    maxOutputTokens: 3000, effort: 'low', temperature: 0.5, maxRetries: 2, promptVersion: PROMPT_VERSION,
  })
  costUsd += blocks.meta.costUsd ?? 0
  run.blocks = { ...blocks.object, suggestedTags: await validateSuggestedTags(supabase, blocks.object.suggestedTags) }
  run.status = 'critic'

  // Stage 4 — the editor: rules, then the model at temperature 0
  const profile = await getVoiceProfile(supabase, userId)
  const familyNames = (profile?.family_members ?? []).map((m) => m.name?.trim() ?? '').filter((n) => n.length >= 2)
  const texts = run.outline.parts.map((_, i) => run.sections[i]?.text ?? '')
  const findings: CriticFinding[] = runRules({ brief, parts: run.outline.parts, texts, familyNames })
  const critic = await aiGenerateObjectWithMeta<CriticModelOutput>({
    bucket: 'content', tag: 'eval-critic', schema: CriticOutput, system: CRITIC_SYSTEM,
    messages: [{ role: 'user', content: criticPrompt(run, blocksText(run), voiceProfileFactLines(profile)) }],
    maxOutputTokens: 2000, effort: 'low', temperature: 0, maxRetries: 2, promptVersion: PROMPT_VERSION,
  })
  costUsd += critic.meta.costUsd ?? 0
  for (const f of critic.object.findings) {
    findings.push({ severity: f.severity, code: f.code, message: f.message, part: f.part != null ? f.part - 1 : null, quote: f.quote ?? null, source: 'model' })
  }
  return { run, findings, summary: critic.object.summary, costUsd, truncatedParts }
}

const totals = { pieces: 0, costUsd: 0, blocks: 0, warns: 0, notes: 0 }

function judge(label: string, r: PieceResult) {
  const parts = r.run.outline!.parts
  const texts = parts.map((_, i) => r.run.sections[i]?.text ?? '')
  const by = (s: CriticFinding['severity']) => r.findings.filter((f) => f.severity === s)
  const fmt = (f: CriticFinding) => `  [${f.severity}/${f.code}${f.part != null ? ` part ${f.part + 1}` : ''}] ${f.message}${f.quote ? ` — "${f.quote}"` : ''}`

  const words = texts.map((t) => t.split(/\s+/).filter(Boolean).length)
  console.log(
    `\n── ${label} ──  $${r.costUsd.toFixed(3)} · ${parts.length} parts · ${words.reduce((a, b) => a + b, 0)} words` +
    `\n  title: ${r.run.outline!.title}` +
    `\n  parts: ${parts.map((p, i) => `${p.kind === 'intro' ? 'intro' : p.heading} ${words[i]}/${p.targetWords}`).join(' · ')}` +
    `\n  editor: ${r.summary}` +
    (r.findings.length ? `\n${r.findings.map(fmt).join('\n')}` : '\n  (no findings)'),
  )
  totals.pieces += 1
  totals.costUsd += r.costUsd
  totals.blocks += by('block').length
  totals.warns += by('warn').length
  totals.notes += by('note').length

  // Objective floor — these would reach the page as-is.
  expect(r.truncatedParts, `${label}: parts cut off by the token budget`).toEqual([])
  for (let i = 0; i < parts.length; i++) {
    expect(words[i], `${label}: part ${i + 1} is thin (${words[i]} words vs target ${parts[i].targetWords})`)
      .toBeGreaterThanOrEqual(Math.floor(parts[i].targetWords * MIN_LENGTH_RATIO))
    expect(EMOJI.test(texts[i]), `${label}: emoji in part ${i + 1}`).toBe(false)
    expect(MD_HEADING.test(texts[i]), `${label}: markdown heading inside part ${i + 1} (headings come from the outline)`).toBe(false)
    if (MD_BOLD.test(texts[i])) console.warn(`${label}: markdown bold in part ${i + 1} — it will render literally`)
  }

  // The editor's verdict — the rubric the author sees.
  expect(by('block').map(fmt), `${label}: blocking findings`).toHaveLength(MAX_BLOCK_FINDINGS)
  expect(by('warn').length, `${label}: too many warnings\n${by('warn').map(fmt).join('\n')}`).toBeLessThanOrEqual(MAX_WARN_FINDINGS)

  // Blocks the outline asked for must exist and be substantive.
  const choices = r.run.outline!.blocks
  const b = r.run.blocks!
  if (choices.tldr) expect(b.tldr?.trim().length ?? 0, `${label}: empty TL;DR`).toBeGreaterThan(20)
  if (r.run.contentType === 'review' && choices.prosCons) {
    expect(b.pros?.length ?? 0, `${label}: fewer than ${MIN_PROS} pros`).toBeGreaterThanOrEqual(MIN_PROS)
    expect(b.cons?.length ?? 0, `${label}: fewer than ${MIN_CONS} cons`).toBeGreaterThanOrEqual(MIN_CONS)
  }
  expect(b.suggestedTags.length, `${label}: suggested tags`).toBeLessThanOrEqual(10)
}

describe.skipIf(!READY)('Content golden eval', () => {
  if (!READY) {
    it('skipped — missing env', () => {
      console.warn('content:eval skipped — need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + (AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN)')
    })
    return
  }

  const supabase = adminClient()
  let userId = ''

  afterAll(() => {
    if (!totals.pieces) return
    console.log(
      `\n══ content:eval · prompt ${PROMPT_VERSION} · ${totals.pieces} pieces · $${totals.costUsd.toFixed(2)} total` +
      ` · block ${totals.blocks} · warn ${totals.warns} · note ${totals.notes} ══\n`,
    )
  })

  for (const { label, input } of BRIEFS) {
    it(label, async () => {
      if (!userId) userId = await resolveAuthor(supabase)
      const brief = normalizeBrief(BriefInput.parse(input))
      const result = await generate(brief, { supabase, userId })
      judge(label, result)
    }, PER_PIECE_TIMEOUT_MS)
  }
})
