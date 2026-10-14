#!/usr/bin/env node
// RATCHET guard for the Hard Goods design commit (brand-guide §10.1, 2026-10-14).
// Fails the build when a public/auth surface gains NEW dark-era construction, or an
// existing offender count GROWS. It never demands the old offenders be fixed all at
// once — that is what the baseline is for.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE BUG THIS EXISTS FOR (docs/continuity-fix-plan.md §4 P16)
//
// The Hard Goods sweep flipped the canvas to light and rebuilt the primitives, but
// dozens of surfaces kept dark-era construction that still compiles, still passes
// ESLint and still renders — just wrongly on white: `border-faint` (a hairline
// colour tuned for #18181b) is an invisible edge; `bg-accent/10` is the banned peach
// tint; white 14px text on the orange block misses AA; `rounded-full px-3` is a pill
// where Hard Goods chips are square; a 13px `<input>` makes an iPhone zoom the page;
// `hover:bg-accent-hover` on a hand-rolled button is the tell that someone rebuilt
// `buttonVariants('primary')` by hand; native `confirm()` is a browser dialog in a
// brand that has a Modal. None of it is visible to `tsc`, ESLint's raw-shade rule
// (which only sees JSX className literals, not cn() args or template strings), or a
// reviewer skimming a diff — and the next feature copies whichever neighbour it
// opened first, so the old construction keeps breeding.
//
// WHY A RATCHET AND NOT A STRICT GUARD: the migration is ten phases over several
// sessions. A strict guard would fail the build on day one (hundreds of hits), and a
// guard that can't be armed until the migration is done guards nothing during the
// migration — which is exactly when the copy-paste risk is highest. So:
//
//   scripts/hard-goods-baseline.json   { "<posix path>": { "R1": n, "R4": n } }
//
// records today's offenders per file and rule. The guard fails on any file/rule whose
// current count EXCEEDS its baseline (a missing entry is 0, so a brand-new offender
// in a clean file always fails). Counts that SHRINK pass, with a note suggesting
// `--update-baseline` to lock the progress in — a ratchet only works if it tightens.
// Each phase deletes the entries it clears; Phase 10 leaves the file `{}`, and from
// then on it is a strict guard with no code change. A missing baseline file = empty
// baseline = strict.
//
// Because the baseline is COUNTS, not line numbers, ordinary edits that shift code
// around never trip it. The cost: swapping one offender for another in the same
// file/rule is invisible. Accepted — the goal is "never get worse", not forensics.
//
// RENAMES: a renamed/moved file shows up as a new path, so its offenders fail until
// you run `--update-baseline`. Do that in the same commit as the rename.
//
// USAGE
//   node scripts/check-hard-goods.mjs                    check against the baseline
//   node scripts/check-hard-goods.mjs --update-baseline  rewrite the baseline to now
//
// HOW IT MATCHES (and what it deliberately doesn't)
// A tiny single-pass lexer, not a parser — plain Node, no dependencies, ~0.2s. It
// blanks `//` and `/* */` comments (replacing them with spaces and keeping newlines,
// so line numbers stay true) and collects every string literal. Comments are the
// whole reason for a lexer: the codebase's own migration notes say things like
// "removed bg-accent/15" and "no confirm()", and a regex over raw lines flagged
// every one of them.
//   * String-aware: `https://` inside a string is not a comment.
//   * JSX text is not JS, so a lone apostrophe ("Don't") would open a "string" that
//     swallows code. Defences: a quote glued to a word char / `)` `]` `}` is never a
//     string start; an unterminated string ends at its newline; `://` is never a
//     comment; an unterminated regex literal is un-read. Damage from a missed case
//     is bounded to one line.
//   * R1/R2 need a whole CLASS STRING (one string literal; a template literal's
//     static parts count as one, `${…}` holes become spaces and strings nested
//     inside holes are their own class strings). `cn('bg-accent text-white', 'text-sm')`
//     splits across two literals and is NOT caught — a known gap; the common case is
//     one literal.
//   * R7 scans the opening tag with a brace-depth + quote-aware scanner because
//     attributes contain arrow functions (`onChange={(e) => …}`) whose `>` is not
//     the tag's end. A className held in a variable (`className={inputCls}`) is
//     invisible to it — also a known gap.
//
// Scope: .ts/.tsx under app/(public), app/(auth), components/ — minus the surfaces
// the plan leaves alone (workspace, admin, dashboard, media, SyncMerchButton).

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, extname, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BASELINE_PATH = join(ROOT, 'scripts', 'hard-goods-baseline.json')

const SCAN_ROOTS = ['app/(public)', 'app/(auth)', 'components']
const EXTS = new Set(['.ts', '.tsx'])
const EXCLUDED_PREFIXES = [
  'components/workspace/',
  'components/admin/',
  'components/dashboard/',
  'components/media/',
]
const EXCLUDED_FILES = new Set(['components/merch/SyncMerchButton.tsx'])
// The one file allowed to spell out the primary-button hover (it IS the primitive).
const R8_ALLOWED = 'components/ui/Button.tsx'

export const RULES = {
  R1: 'white BODY text on an orange fill misses AA (text-white + text-sm/base/lg on bg-accent) — use text-chrome, or keep it chip-sized',
  R2: 'rounded-full + padding is a pill; Hard Goods chips/badges are square (4px radius)',
  R3: 'bg-accent/N is the banned peach accent-tint — use a neutral tint token or a solid block',
  R4: 'border-faint is invisible on white — use border-soft / border-strong',
  R5: 'native confirm()/prompt()/alert() — use the Modal / toast primitives',
  R6: 'raw red/green/orange/purple/blue/amber/stone shade — use a semantic role token from app/globals.css',
  R7: 'input/textarea under 16px — iPhone zooms the page on focus and the tap target shrinks; add text-base',
  R8: 'hover:bg-accent-hover outside Button.tsx is a hand-rolled primary button — use buttonVariants()',
}
const RULE_IDS = Object.keys(RULES)

// ── lexer ─────────────────────────────────────────────────────────────────────

// Is `/` at index i the start of a regex literal (vs division, `</tag>`, `/>`)?
// Decided by the previous significant char; `)` `]` `}` `>` and identifiers mean
// division/JSX, so they are deliberately NOT in the list.
const REGEX_PREV = new Set(['', '=>', '(', ',', '=', ':', '[', '!', '&', '|', '?', ';', '{', '~', '+', '-', '*', '%', '^'])
const REGEX_KEYWORD = /(?:^|[^\w$])(?:return|typeof|case|in|of|delete|void|throw|new|yield|await)\s*$/

function regexEnd(src, i) {
  // src[i] === '/'. Returns the index after the literal (and its flags), or -1.
  const n = src.length
  let j = i + 1
  let inClass = false
  while (j < n) {
    const c = src[j]
    if (c === '\n') return -1
    if (c === '\\') { j += 2; continue }
    if (c === '[') inClass = true
    else if (c === ']') inClass = false
    else if (c === '/' && !inClass) {
      j++
      while (j < n && /[a-z]/.test(src[j])) j++
      return j
    }
    j++
  }
  return -1
}

// Lex code starting at i. With inBrace, stops after the `}` that closes the `{`
// already consumed by the caller (a JSX expression or template `${`) and returns the
// index after it. `sink` (or null) collects { comments: [s,e][], strings: {text,index}[] }.
function lexCode(src, i, inBrace, sink) {
  const n = src.length
  let depth = 0
  let prev = ''
  while (i < n) {
    const c = src[i]
    const d = src[i + 1]

    if (c === '/' && d === '/' && src[i - 1] !== ':' && src[i - 1] !== '\\') {
      let j = src.indexOf('\n', i)
      if (j < 0) j = n
      if (sink) sink.comments.push([i, j])
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      const j = src.indexOf('*/', i + 2)
      if (j >= 0) {
        if (sink) sink.comments.push([i, j + 2])
        i = j + 2
        continue
      }
    }
    if (c === '"' || c === "'") {
      if (i > 0 && /[\w$)\]}]/.test(src[i - 1])) { i++; prev = c; continue } // apostrophe in JSX text
      let j = i + 1
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1
      if (src[j] !== c && prev === '=') {
        // A JSX attribute string (`className="a\n b"`) may span lines and has no escapes.
        const k = src.indexOf(c, i + 1)
        if (k > 0) j = k
      }
      if (src[j] === c) {
        if (sink) sink.strings.push({ text: src.slice(i + 1, j), index: i })
        i = j + 1
      } else {
        i = Math.min(j, n) // unterminated: it was JSX text; resume at the newline
      }
      prev = c
      continue
    }
    if (c === '`') {
      i = lexTemplate(src, i, sink)
      prev = '`'
      continue
    }
    if (c === '/' && d !== '/' && d !== '*' &&
        (REGEX_PREV.has(prev) || (/[a-z]/.test(prev) && REGEX_KEYWORD.test(src.slice(Math.max(0, i - 12), i))))) {
      const e = regexEnd(src, i)
      if (e > 0) { i = e; prev = '/'; continue }
    }
    if (c === '{') depth++
    else if (c === '}') {
      if (inBrace && depth === 0) return i + 1
      if (depth > 0) depth--
    }
    if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') prev = c === '>' && src[i - 1] === '=' ? '=>' : c
    i++
  }
  return n
}

// src[i] === '`'. Records the static parts as ONE string; returns the index after the
// closing backtick.
function lexTemplate(src, i, sink) {
  const n = src.length
  const start = i
  const parts = []
  let cur = ''
  i++
  while (i < n) {
    const c = src[i]
    if (c === '\\') { cur += src.slice(i, i + 2); i += 2; continue }
    if (c === '`') { i++; break }
    if (c === '$' && src[i + 1] === '{') {
      parts.push(cur)
      cur = ''
      i = lexCode(src, i + 2, true, sink)
      continue
    }
    cur += c
    i++
  }
  parts.push(cur)
  if (sink) sink.strings.push({ text: parts.join(' '), index: start })
  return i
}

/** Lex a source file → { stripped (comments blanked, same length), strings }. */
export function lex(src) {
  const sink = { comments: [], strings: [] }
  lexCode(src, 0, false, sink)
  let stripped = src
  if (sink.comments.length) {
    let out = ''
    let last = 0
    for (const [s, e] of sink.comments) {
      out += src.slice(last, s) + src.slice(s, e).replace(/[^\n]/g, ' ')
      last = e
    }
    stripped = out + src.slice(last)
  }
  return { stripped, strings: sink.strings }
}

// ── rule matchers (pure) ──────────────────────────────────────────────────────

// Class-string rules. `(?<!\S)` / `(?!\S)` = a whole whitespace-delimited class, so
// `hover:bg-accent`, `bg-accent/10` and `bg-accent-hover` are different classes.
const BG_ACCENT = /(?<!\S)!?bg-accent(?!\S)/
const TEXT_WHITE = /(?<!\S)!?text-white(?:\/\d+)?(?!\S)/
const BODY_SIZE = /(?<!\S)!?(?:(?:sm|md|lg|xl|2xl):)?text-(?:sm|base|lg)(?:\/[\w.[\]-]+)?(?!\S)/
const ROUNDED_FULL = /(?<![\w-])rounded-full(?![\w-])/
const PADDING = /(?<![\w-])p[xy]-(?=[\w.[])/

/** R1: one class string with bg-accent + text-white + a body size. */
export const isR1 = (cls) => BG_ACCENT.test(cls) && TEXT_WHITE.test(cls) && BODY_SIZE.test(cls)
/** R2: one class string with rounded-full + px-/py- (a pill). */
export const isR2 = (cls) => ROUNDED_FULL.test(cls) && PADDING.test(cls)

// Whole-source rules, matched against the comment-stripped text.
const R3_RE = /(?<![\w-])bg-accent\/[\d[]/g
const R4_RE = /(?<![\w-])border(?:-[trblxyse])?-faint(?![\w-])/g
// window.confirm( / globalThis.alert( / bare prompt( — NOT x.confirm(, useConfirm(,
// onConfirm(, confirmPayment(, or `function alert(` (a definition).
const R5_RE = /(?<![\w$.])(?<!function\s)(?:(?:window|globalThis)\.)?(?:confirm|prompt|alert)\(/g
const R6_RE = new RegExp(
  '(?<![\\w-])(?:bg|text|border|ring|from|via|to|fill|stroke|outline|divide|decoration|shadow|accent|caret|placeholder)' +
  '(?:-(?:[trblxy]|offset))?-(?:red|green|orange|purple|blue|amber|stone)-\\d{2,3}(?:\\/[\\w.[\\]%]+)?(?![\\w-])',
  'g',
)
// `hover:` itself, not `group-hover:` / `peer-hover:` (those style a child, not a button).
const R8_RE = /(?<![\w-])hover:bg-accent-hover(?![\w-])/g

const INPUT_OPEN_RE = /<(input|textarea)(?=[\s/>])/g
const EXCLUDED_INPUT_TYPE = /\btype\s*=\s*\{?\s*["'`]?(?:checkbox|radio|hidden|file|range|color)\b/
const SMALL_TEXT_RE = /(?<![\w-])text-(?:xs|sm)(?![\w-])/
const PX_TEXT_RE = /(?<![\w-])text-\[(\d+(?:\.\d+)?)px\]/g
const TEXT_BASE_RE = /(?<![\w-])text-base(?![\w-])/

const hasSmallText = (tag) => {
  if (SMALL_TEXT_RE.test(tag)) return true
  for (const m of tag.matchAll(PX_TEXT_RE)) if (Number(m[1]) < 16) return true
  return false
}

/** R7 predicate over one opening tag's text. */
export function isR7Tag(tag, isInput) {
  if (isInput && EXCLUDED_INPUT_TYPE.test(tag)) return false
  return hasSmallText(tag) && !TEXT_BASE_RE.test(tag)
}

// End index (after `>`) of the JSX opening tag whose attributes start at i.
function tagEnd(s, i) {
  const n = s.length
  let j = i
  while (j < n) {
    const c = s[j]
    if (c === '"' || c === "'") {
      const k = s.indexOf(c, j + 1)
      if (k < 0) return n
      j = k + 1
    } else if (c === '{') {
      j = lexCode(s, j + 1, true, null)
    } else if (c === '>') {
      return j + 1
    } else {
      j++
    }
  }
  return n
}

/** Scan one file's source → hits [{ rule, line, col, snippet }], sorted by line. */
export function scanSource(src, relPath) {
  const { stripped, strings } = lex(src)

  const lineStarts = [0]
  for (let i = 0; i < stripped.length; i++) if (stripped.charCodeAt(i) === 10) lineStarts.push(i + 1)
  const lineOf = (idx) => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineStarts[mid] <= idx) lo = mid
      else hi = mid - 1
    }
    return lo
  }
  const srcLines = src.split('\n')

  const hits = []
  const hit = (rule, idx) => {
    const l = lineOf(idx)
    const col = idx - lineStarts[l]
    const raw = srcLines[l] ?? ''
    let snippet = raw.trim()
    if (snippet.length > 110) {
      const from = Math.max(0, col - 40)
      snippet = (from > 0 ? '…' : '') + raw.slice(from, from + 110).trim() + '…'
    }
    hits.push({ rule, line: l + 1, snippet })
  }

  for (const s of strings) {
    if (isR1(s.text)) hit('R1', s.index)
    if (isR2(s.text)) hit('R2', s.index)
  }
  const matchAll = (rule, re) => { for (const m of stripped.matchAll(re)) hit(rule, m.index) }
  matchAll('R3', R3_RE)
  matchAll('R4', R4_RE)
  matchAll('R5', R5_RE)
  matchAll('R6', R6_RE)
  if (relPath !== R8_ALLOWED) matchAll('R8', R8_RE)

  for (const m of stripped.matchAll(INPUT_OPEN_RE)) {
    const end = tagEnd(stripped, m.index + m[0].length)
    if (isR7Tag(stripped.slice(m.index, end), m[1] === 'input')) hit('R7', m.index)
  }

  return hits.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule))
}

// ── walking + baseline ────────────────────────────────────────────────────────

const toPosix = (p) => p.split(sep).join('/')

function walk(dir, out) {
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (EXTS.has(extname(path)) && !/\.test\.[^/\\]+$/.test(entry)) out.push(path)
  }
}

function inScope(rel) {
  return !EXCLUDED_FILES.has(rel) && !EXCLUDED_PREFIXES.some((p) => rel.startsWith(p))
}

function collect() {
  const files = []
  for (const r of SCAN_ROOTS) walk(join(ROOT, r), files)
  const rels = files.map((f) => toPosix(relative(ROOT, f))).filter(inScope).sort()
  const hitsByFile = {}
  const counts = {}
  for (const rel of rels) {
    const hits = scanSource(readFileSync(join(ROOT, rel), 'utf8'), rel)
    if (!hits.length) continue
    hitsByFile[rel] = hits
    counts[rel] = {}
    for (const h of hits) counts[rel][h.rule] = (counts[rel][h.rule] ?? 0) + 1
  }
  return { scanned: rels.length, hitsByFile, counts }
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return {}
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    return parsed
  } catch (e) {
    console.error(`✖ Hard Goods: scripts/hard-goods-baseline.json is unreadable (${e.message}).`)
    console.error('  Fix the JSON or run `node scripts/check-hard-goods.mjs --update-baseline`.')
    process.exit(1)
  }
}

const sortedBaseline = (counts) => {
  const out = {}
  for (const file of Object.keys(counts).sort()) {
    const rules = {}
    for (const r of RULE_IDS) if (counts[file][r]) rules[r] = counts[file][r]
    if (Object.keys(rules).length) out[file] = rules
  }
  return out
}

const total = (counts) =>
  Object.values(counts).reduce((a, rules) => a + Object.values(rules).reduce((x, y) => x + y, 0), 0)

const perRuleSummary = (counts) => {
  const t = Object.fromEntries(RULE_IDS.map((r) => [r, 0]))
  for (const rules of Object.values(counts)) for (const [r, n] of Object.entries(rules)) t[r] = (t[r] ?? 0) + n
  return RULE_IDS.filter((r) => t[r]).map((r) => `${r}:${t[r]}`).join(' ')
}

function main() {
  const update = process.argv.includes('--update-baseline')
  const { scanned, hitsByFile, counts } = collect()

  if (update) {
    const before = total(loadBaseline())
    const next = sortedBaseline(counts)
    writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n')
    console.log(
      `✓ Hard Goods baseline written: ${total(next)} offender(s) in ${Object.keys(next).length} file(s) ` +
      `(was ${before}) — ${perRuleSummary(next) || 'empty'}`,
    )
    return
  }

  const baseline = loadBaseline()
  const grew = [] // { file, rule, base, now }
  const shrank = []
  const files = new Set([...Object.keys(counts), ...Object.keys(baseline)])
  for (const file of [...files].sort()) {
    for (const rule of RULE_IDS) {
      const now = counts[file]?.[rule] ?? 0
      const base = baseline[file]?.[rule] ?? 0
      if (now > base) grew.push({ file, rule, base, now })
      else if (now < base) shrank.push({ file, rule, base, now })
    }
  }

  if (grew.length) {
    const occurrences = grew.reduce((a, g) => a + g.now, 0)
    console.error(`\n✖ Hard Goods ratchet: ${grew.length} file/rule pair(s) went past the baseline\n`)
    for (const g of grew) {
      console.error(`  ${g.file}  ${g.rule}  baseline ${g.base} → now ${g.now}`)
      for (const h of hitsByFile[g.file].filter((x) => x.rule === g.rule)) {
        console.error(`    ${g.file}:${h.line}  ${g.rule}  ${RULES[g.rule]}`)
        console.error(`        ${h.snippet}`)
      }
    }
    console.error(`
  ${occurrences} occurrence(s) listed — the ratchet can't tell which are the new ones, so
  every occurrence of a grown rule in that file is shown. Fix the NEW construction with
  the Hard Goods primitives (buttonVariants, Modal, role tokens — brand-guide §10.1);
  don't raise the baseline to make this pass. Only run --update-baseline after a
  migration pass that SHRINKS counts (or after renaming a file).
`)
    process.exit(1)
  }

  if (shrank.length) {
    const cleared = shrank.reduce((a, s) => a + (s.base - s.now), 0)
    console.log(
      `ℹ Hard Goods: ${cleared} baseline offender(s) cleared across ${new Set(shrank.map((s) => s.file)).size} file(s) — ` +
      'run `node scripts/check-hard-goods.mjs --update-baseline` to lock that progress in.',
    )
  }
  const remaining = total(baseline)
  console.log(
    `✓ Hard Goods: ${scanned} files scanned, no new offenders ` +
    `(${remaining} baseline offender${remaining === 1 ? '' : 's'} remain${remaining === 1 ? 's' : ''}` +
    `${remaining ? ` — ${perRuleSummary(baseline)}` : ' — strict'})`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
