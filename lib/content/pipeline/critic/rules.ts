import type { Brief, CriticFinding, OutlinePart } from '../types'
import { briefProductSlugs } from '../briefs'

// Stage 4a — the deterministic half of the critic. Everything here is a string
// check the brand rules already state (BOSS_DADDY_SYSTEM); a model is only
// asked about the things a regex can't judge (lib/content/pipeline/critic/model.ts).

const HYPE = ['revolutionary', 'game-changer', 'game changer', 'elevate your', 'next level', 'must-have', 'best ever']
const CORPORATE = ['leverage', 'synergy', 'circle back', 'stakeholder', 'deep-dive', 'deep dive', 'ecosystem']
const SPONSORED = ['in partnership with', 'thanks to our friends at', 'brought to you by']
const SOFT_PARENTING = ['every child is unique', 'no judgment', 'you do you']
const BRAND_GREETING = [/\b(hey|listen up|alright|okay|ok),?\s+boss\s+dads?\b/i, /\bboss\s+dads?,\s+(listen|here)/i]
const HEDGES = /\b(may|might|could)\b/gi
const VAGUE_TIME = /\brecently\b/gi

function esc(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

function findPhrase(texts: string[], phrase: string): { part: number; quote: string } | null {
  const re = new RegExp(`\\b${esc(phrase)}\\b`, 'i')
  for (let i = 0; i < texts.length; i++) {
    const m = texts[i].match(re)
    if (m) return { part: i, quote: snippet(texts[i], m.index ?? 0) }
  }
  return null
}

function snippet(text: string, at: number): string {
  const start = Math.max(0, at - 40)
  const end = Math.min(text.length, at + 60)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 3)
}

export interface RulesInput {
  brief: Brief
  parts: OutlinePart[]
  /** Aligned with parts; '' for unwritten. */
  texts: string[]
  /** Family members' names from the voice profile — must never appear. */
  familyNames: string[]
}

export function runRules({ brief, parts, texts, familyNames }: RulesInput): CriticFinding[] {
  const out: CriticFinding[] = []
  const inquiry = brief.contentType === 'guide' && brief.inquiryMode
  const all = texts.join('\n\n')

  // Family names — the publication rule, and a hard stop.
  for (const name of familyNames) {
    const n = name.trim()
    if (n.length < 2) continue
    const hit = findPhrase(texts, n)
    if (hit) out.push({ severity: 'block', code: 'family-name', source: 'rules', part: hit.part, quote: hit.quote,
      message: `Names a family member ("${n}") — family stays unnamed; use the relationship.` })
  }

  // Banlists.
  for (const p of HYPE) { const h = findPhrase(texts, p); if (h) out.push({ severity: 'warn', code: 'hype', source: 'rules', part: h.part, quote: h.quote, message: `Hype phrase "${p}".` }) }
  for (const p of CORPORATE) { const h = findPhrase(texts, p); if (h) out.push({ severity: 'warn', code: 'corporate', source: 'rules', part: h.part, quote: h.quote, message: `Corporate jargon "${p}".` }) }
  for (const p of SPONSORED) { const h = findPhrase(texts, p); if (h) out.push({ severity: 'block', code: 'sponsored-phrasing', source: 'rules', part: h.part, quote: h.quote, message: `Sponsored phrasing "${p}" — the page-level disclosure covers affiliate links.` }) }
  for (const p of SOFT_PARENTING) { const h = findPhrase(texts, p); if (h) out.push({ severity: 'warn', code: 'soft-parenting', source: 'rules', part: h.part, quote: h.quote, message: `Soft-parenting tell "${p}".` }) }
  for (let i = 0; i < texts.length; i++) {
    for (const re of BRAND_GREETING) {
      const m = texts[i].match(re)
      if (m) { out.push({ severity: 'warn', code: 'brand-greeting', source: 'rules', part: i, quote: snippet(texts[i], m.index ?? 0), message: 'Greets the reader with the brand name — "Boss Dads" is a third-person identity, never an address.' }); break }
    }
  }

  // Hedges are banned outside the inquiry register; vague time refs always.
  if (!inquiry) {
    for (let i = 0; i < texts.length; i++) {
      const m = texts[i].match(HEDGES)
      if (m && m.length >= 2) out.push({ severity: 'note', code: 'hedge-words', source: 'rules', part: i, message: `${m.length} hedge words (may/might/could) in this part.` })
    }
  }
  for (let i = 0; i < texts.length; i++) {
    const m = texts[i].match(VAGUE_TIME)
    if (m) out.push({ severity: 'note', code: 'vague-time', source: 'rules', part: i, message: '"Recently" — give the actual timeframe or cut it.' })
  }

  // Product tokens: exactly what the outline assigned, nowhere else.
  const slugs = briefProductSlugs(brief)
  const tokenRe = /\[\[BUY:([a-z0-9-]+)\]\]/g
  for (let i = 0; i < texts.length; i++) {
    const found = [...texts[i].matchAll(tokenRe)].map((m) => m[1])
    const expected = parts[i]?.productToken ?? null
    if (expected && found.filter((s) => s === expected).length !== 1) {
      out.push({ severity: 'block', code: 'product-token', source: 'rules', part: i, message: `Expected exactly one [[BUY:${expected}]] in this part, found ${found.filter((s) => s === expected).length}.` })
    }
    const stray = found.filter((s) => s !== expected)
    if (stray.length) {
      out.push({ severity: 'block', code: 'product-token', source: 'rules', part: i, message: `Unexpected product token(s) here: ${stray.map((s) => `[[BUY:${s}]]`).join(', ')}.` })
    }
    const unknown = found.filter((s) => !slugs.includes(s))
    if (unknown.length) {
      out.push({ severity: 'block', code: 'product-token', source: 'rules', part: i, message: `Token for a product that isn't linked to this piece: ${unknown.join(', ')}.` })
    }
  }
  if (/https?:\/\/|amazon\.com|geni\.us/i.test(all)) {
    out.push({ severity: 'block', code: 'raw-url', source: 'rules', message: 'A raw product URL appears in the prose — only [[BUY:]] tokens may link.' })
  }

  // Rhythm: a flat sentence-length distribution reads machine-made.
  const lens = sentences(all).map((s) => s.split(/\s+/).length)
  if (lens.length >= 20) {
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length
    const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length)
    if (sd < 4.5) out.push({ severity: 'note', code: 'sentence-monotony', source: 'rules', message: `Sentence lengths barely vary (σ ≈ ${sd.toFixed(1)} words) — vary the rhythm.` })
    const run = longestRunOver(lens, 32)
    if (run >= 3) out.push({ severity: 'note', code: 'run-ons', source: 'rules', message: `${run} consecutive sentences over 32 words.` })
  }

  // Length vs the author's targets.
  for (let i = 0; i < texts.length; i++) {
    const words = texts[i].split(/\s+/).filter(Boolean).length
    const target = parts[i]?.targetWords ?? 0
    if (target && words > target * 1.6) out.push({ severity: 'note', code: 'over-length', source: 'rules', part: i, message: `${words} words against a target of ${target}.` })
    if (target && words && words < target * 0.5) out.push({ severity: 'note', code: 'under-length', source: 'rules', part: i, message: `${words} words against a target of ${target}.` })
  }

  return out
}

function longestRunOver(lens: number[], threshold: number): number {
  let best = 0, cur = 0
  for (const l of lens) { cur = l > threshold ? cur + 1 : 0; if (cur > best) best = cur }
  return best
}
