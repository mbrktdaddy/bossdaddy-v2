import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { runBossAgent } from '@/lib/boss/agent'
import { BOSS_TOOLS } from '@/lib/boss/tools'
import { buildBossConciergeSystemBlocks } from '@/lib/boss/prompt'
import { getEntitlements } from '@/lib/boss/entitlements'
import { normalizeBossText } from '@/lib/boss/normalizeText'
import type { BossStreamEvent, Block } from '@/lib/boss/types'

// THIN-COVERAGE eval — the branch the main golden suite structurally cannot reach.
//
// boss-eval.ts runs as ANON (`userId = null`), and research_gear is minTier 'free',
// so the research path is gated off there by construction. That suite passing 11/11
// says nothing about this behavior. This file signs in as a real member so
// research_gear is actually reachable.
//
// What it pins: asking a BROAD question about a brand we have exactly ONE tested
// item for must NOT stop at that item. Before the fix, "what are the best weber gas
// grills" returned only the Genesis E-330 Stealth and stopped — correct per the old
// prompt, useless as an answer, and it reduced Ask the Boss to a site search box.
//
// ⚠️ LOCAL ≠ PROD FOR THE RESEARCH BUCKET. `AI_MODEL_RESEARCH` is set in Vercel
// (xai/grok-4.5) but is typically UNSET in .env.local, so a local run silently
// exercises the bucket DEFAULT (Anthropic web search) instead of the Grok path that
// production uses. Timings measured here are therefore NOT prod timings. Check with
// `npm run ai:which`, and prefix the run to match prod:
//     AI_MODEL_RESEARCH=xai/grok-4.5 npx vitest run --config vitest.eval.config.ts …

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const GATEWAY = process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? ''
const READY = Boolean(SUPABASE_URL && SUPABASE_ANON && GATEWAY)

// A real profile id — research_gear's roadmap log writes a row keyed to it, and the
// rate limiter needs a stable key. Entitlements map any non-null id to 'free'.
const MEMBER_ID = '28aafc2f-c6b2-4b3e-a4c8-82dc60a40b0f'

type Collected = { text: string; tools: string[]; blocks: Block[]; error: string | null }

async function runAsMember(prompt: string): Promise<Collected> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } })
  const entitlements = await getEntitlements(MEMBER_ID)
  const system = await buildBossConciergeSystemBlocks(supabase, MEMBER_ID, {
    personalize: entitlements.personalize,
  })
  const ctx = { supabase, userId: MEMBER_ID, entitlements }
  const out: Collected = { text: '', tools: [], blocks: [], error: null }

  for await (const ev of runBossAgent({
    system,
    messages: [{ role: 'user', content: prompt }],
    tools: BOSS_TOOLS,
    ctx,
  }) as AsyncGenerator<BossStreamEvent>) {
    if (ev.type === 'text') out.text += ev.delta
    else if (ev.type === 'tool_start') out.tools.push(ev.name)
    else if ((ev as { type: string }).type === 'blocks') {
      const items = (ev as unknown as { items?: Block[] }).items
      if (Array.isArray(items)) out.blocks.push(...items)
    } else if (ev.type === 'error') out.error = ev.message
  }
  return out
}

describe.skipIf(!READY)('Boss thin-coverage (member tier)', () => {
  if (!READY) {
    it('skipped — missing env', () => {
      console.warn('skipped — need SUPABASE URL + anon key + AI_GATEWAY_API_KEY')
    })
    return
  }

  it('broad brand question with ONE tested item → leads with it AND researches the rest', async () => {
    const r = await runAsMember('what are the best weber gas grills')
    const shown = normalizeBossText(r.text)

    console.log(
      `\n── thin-coverage ──\n  tools: [${r.tools.join(', ') || '—'}]  blocks: ${r.blocks.length}` +
        (r.error ? `  ERROR: ${r.error}` : '') +
        `\n  kinds: [${r.blocks.map((b) => b.kind).join(', ') || '—'}]` +
        `\n\n${shown}\n`,
    )

    expect(r.error, 'stream errored').toBeNull()

    // 1. The vault is still consulted first.
    expect(r.tools, 'search_gear must still run first').toContain('search_gear')

    // 2. THE FIX: it must not stop at the single tested item.
    expect(r.tools, 'research_gear must also fire on a broad ask with thin coverage').toContain(
      'research_gear',
    )

    // 3. The tested pick still leads — the vault is the priority, not the boundary.
    expect(/genesis|e-330/i.test(shown), 'the tested Weber should still be surfaced').toBe(true)

    // 4. Integrity: researched picks carry no Boss rating. Only a 'review' block may
    //    have a rating; 'product' blocks (the researched shortlist) must not.
    for (const b of r.blocks) {
      if (b.kind === 'product') {
        expect(
          (b as unknown as { rating?: unknown }).rating ?? null,
          'a researched pick must never carry a Boss rating',
        ).toBeNull()
      }
    }

    // 5. The answer should be materially more than the one-item reply it used to give.
    expect(shown.length, 'answer looks as thin as the pre-fix behavior').toBeGreaterThan(200)
  }, 180_000)

  it('narrow question about the ONE tested item → does NOT trigger research', async () => {
    // The guard against over-firing: a specific ask the vault fully answers should
    // stay fast and local. If this starts calling research_gear, the trigger is too loose.
    const r = await runAsMember('is the weber genesis e-330 stealth any good')
    const shown = normalizeBossText(r.text)

    console.log(
      `\n── narrow (should stay local) ──\n  tools: [${r.tools.join(', ') || '—'}]\n\n${shown}\n`,
    )

    expect(r.error, 'stream errored').toBeNull()
    expect(r.tools, 'search_gear should run').toContain('search_gear')
    expect(
      r.tools.includes('research_gear'),
      'a question the vault fully answers should NOT pay for web research',
    ).toBe(false)
  }, 180_000)
})
