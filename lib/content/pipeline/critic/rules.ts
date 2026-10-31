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
// The inquiry-register shrug — the closing that hands the question back (brand-guide §1.6).
const SHRUG = ['up to each dad', 'up to every dad', 'up to you to decide', 'only you can decide', 'no right answer', 'no right or wrong answer', 'no easy answer', 'both sides have a point', 'both sides make', 'reasonable people can disagree', "i'll leave that to you", 'leave it to you to decide', 'the choice is yours', "there's no one answer", 'decide for yourself']
// A chapter:verse citation — fine where the notes brought it; sermon creep in a gear piece (brand-guide §1.6 Faith, density rule).
const SCRIPTURE = /\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)\s+\d{1,3}:\d{1,3}/g
const LIST_LINE = /^(?:[-*]|\d+[.)])\s+\S/
const NUMBERED_LINE = /^\d+[.)]\s+\S/
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

  // Hedges: banned outside the inquiry register (2+ in a part is a note). Inside
  // it they are tolerated for a view the author is not taking — never on the
  // thesis — so bodies get slack and the closing is held to the strict count
  // (brand-guide §1.6, "a witness, not a student"). Vague time refs: always.
  for (let i = 0; i < texts.length; i++) {
    const m = texts[i].match(HEDGES)
    if (!m) continue
    if (!inquiry) {
      if (m.length >= 2) out.push({ severity: 'note', code: 'hedge-words', source: 'rules', part: i, message: `${m.length} hedge words (may/might/could) in this part.` })
    } else if (parts[i]?.kind === 'closing' && m.length >= 2) {
      out.push({ severity: 'warn', code: 'hedge-words', source: 'rules', part: i, message: `${m.length} hedge words (may/might/could) in the closing — the position is stated as a conviction, not a maybe.` })
    } else if (m.length >= 4) {
      out.push({ severity: 'note', code: 'hedge-words', source: 'rules', part: i, message: `${m.length} hedge words (may/might/could) in this part — fine on a view you're not taking, never on the thesis.` })
    }
  }
  if (inquiry) {
    // The shrug: a block in the closing (that is where the position lives), a warn anywhere else.
    for (const p of SHRUG) {
      const h = findPhrase(texts, p)
      if (!h) continue
      const closing = parts[h.part]?.kind === 'closing'
      out.push({ severity: closing ? 'block' : 'warn', code: 'inquiry-shrug', source: 'rules', part: h.part, quote: h.quote,
        message: closing ? `"${p}" in the closing — the register lands on a conviction; it does not hand the question back.` : `"${p}" — state the position; the reader is free to disagree with it.` })
    }
    const ci = parts.findIndex((p) => p.kind === 'closing')
    if (ci >= 0 && (texts[ci] ?? '').trim().endsWith('?')) {
      out.push({ severity: 'note', code: 'closing-question', source: 'rules', part: ci, message: 'The piece ends on a question — welcome after the answer, never instead of it. Make sure the position landed first.' })
    }
  } else {
    // Gear pieces: a verse the notes didn't bring is sermon creep (density rule).
    for (let i = 0; i < texts.length; i++) {
      const m = texts[i].match(SCRIPTURE)
      if (m) out.push({ severity: 'note', code: 'scripture-in-gear', source: 'rules', part: i, quote: m[0], message: `Scripture (${m[0]}) in a gear piece — keep it only if the author's notes brought it; otherwise it reads as a sermon insert.` })
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

  // Structure: the light-Markdown subset (docs/rich-elements-plan.md §2).
  const essay = brief.contentType === 'guide' && brief.pieceType === 'essay'
  let partsWithLists = 0
  for (let i = 0; i < texts.length; i++) {
    const lines = texts[i].split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) continue
    const heading = lines.findIndex((l) => /^#{1,2}\s/.test(l))
    if (heading >= 0) out.push({ severity: 'block', code: 'heading-in-part', source: 'rules', part: i, quote: lines[heading].slice(0, 80),
      message: 'A # / ## heading inside a part — the outline owns the headings; rewrite the line as prose or a ### sub-head.' })
    const listLines = lines.filter((l) => LIST_LINE.test(l)).length
    const hasList = listLines > 0
    if (hasList) partsWithLists++
    if (hasList && essay) out.push({ severity: 'warn', code: 'list-in-essay', source: 'rules', part: i, message: 'A list inside an essay — the argument should carry itself in paragraphs.' })
    if (hasList && listLines / lines.length > 0.5 && parts[i]?.format !== 'steps' && parts[i]?.format !== 'list') {
      out.push({ severity: 'note', code: 'list-heavy', source: 'rules', part: i, message: 'More list than prose in a part the outline marked as prose.' })
    }
    const wanted = parts[i]?.kind === 'body' ? parts[i]?.format : undefined
    if ((wanted === 'steps' || wanted === 'list') && !hasList) {
      out.push({ severity: 'note', code: 'format-missing', source: 'rules', part: i, message: `The outline asked for ${wanted === 'steps' ? 'numbered steps' : 'a bulleted list'} here and none was written.` })
    }
    if (wanted === 'steps' && hasList && !lines.some((l) => NUMBERED_LINE.test(l))) {
      out.push({ severity: 'note', code: 'format-missing', source: 'rules', part: i, message: 'Steps should be a numbered list, not bullets.' })
    }
  }
  const quotes = all.split('\n').filter((l) => /^>\s?\S/.test(l.trim())).length
  if (quotes > 1) out.push({ severity: 'note', code: 'pullquote-count', source: 'rules', message: `${quotes} pull-quote lines — one per piece, and only a line that earns re-reading.` })
  const bodyCount = parts.filter((p) => p.kind === 'body').length
  if (!essay && bodyCount >= 3 && partsWithLists > bodyCount / 2) {
    out.push({ severity: 'note', code: 'list-heavy', source: 'rules', message: `Lists in ${partsWithLists} of ${bodyCount} body parts — the piece reads as a checklist, not a column.` })
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
