#!/usr/bin/env node
// Guard script: catch JSX text that silently loses a leading space at compile time.
//
// THE BUG (found live on /how-we-test, 2026-07-27)
//   <strong>Boss Daddy Approved</strong> is the top designation on
//   this site. It&apos;s not a sticker...
//
//   ...rendered as "Boss Daddy Approvedis the top designation". The space in the
//   source is real; the compiler drops it.
//
// THE TRIGGER is three things at once in one JSX text child:
//   1. it starts with a space, immediately after an element (`</strong> is ...`)
//   2. it wraps across a newline
//   3. it contains an HTML entity (&apos; &quot; &#x27; ...)
//
//   Drop any one and the space survives — which is why it looks random. Two
//   visually identical paragraphs behave differently:
//     affiliate-disclosure:87  `</strong> of it. The` + wrap, NO entity  → fine
//     affiliate-disclosure:61  `</strong> We do not...` + wrap + &apos;  → BROKEN
//   Single-line children are always fine (no newline, nothing to trim), which is
//   why the <li> lists on the same pages render correctly.
//
// It bites this codebase specifically because the Boss Daddy voice is
// contraction-heavy — don&apos;t / It&apos;s / aren&apos;t land in nearly every
// prose paragraph, so entity-bearing wrapped text is the norm, not the exception.
//
// THE FIX is the explicit space the repo already uses in ~79 places:
//   <strong>Boss Daddy Approved</strong>{' '}is the top designation on
//
// Runs in the prebuild hook alongside the middleware + OG guards.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Everything that compiles JSX and renders prose to a human.
const ROOTS = ['app', 'components', 'emails']
const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'coverage'])

// A JSX text child whose leading space sits against a preceding element (`>`) or
// interpolation (`}`). Both lose the space — confirmed live on /gifts/[occasion],
// which rendered "curating the anniversaryguide" from `the {occ.label} guide`.
// Only the LEADING space is affected: a trailing space before the next `<` or `{`
// survives (verified against the rendered output of every prerendered page).
const TEXT_AFTER_ELEMENT = /[>}](?<txt>[ \t]+[^<>{}]*?)[<{]/gs
const ENTITY = /&(?:[a-zA-Z]+|#x?[0-9a-fA-F]+);/

const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function collectFiles() {
  const out = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (SKIP.has(e.name)) continue
      const full = join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.name.endsWith('.tsx')) out.push(full)
    }
  }
  for (const r of ROOTS) {
    const base = join(root, r)
    try {
      if (statSync(base).isDirectory()) walk(base)
    } catch {
      /* optional dir */
    }
  }
  return out
}

const failures = []
let filesChecked = 0

for (const file of collectFiles()) {
  filesChecked++
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(TEXT_AFTER_ELEMENT)) {
    const txt = m.groups.txt
    if (!txt.includes('\n')) continue // single-line child: space is safe
    if (!ENTITY.test(txt)) continue // no entity: space survives
    const line = src.slice(0, m.index).split('\n').length
    const rel = file.replace(root, '').replace(/^[\\/]/, '').replace(/\\/g, '/')
    const preview = txt.trim().split('\n')[0].slice(0, 52)
    failures.push(`${rel}:${line}  → the space before "${preview}…" will be dropped`)
  }
}

if (failures.length) {
  console.error(`${RED}${BOLD}\n✗ JSX space check failed${RESET}\n`)
  console.error(
    'These JSX text nodes start with a space, wrap across a newline, and contain an\n' +
      'HTML entity — the compiler drops the leading space, so words render jammed\n' +
      'together ("Boss Daddy Approvedis the top designation"):\n'
  )
  for (const f of failures) console.error(`  • ${f}`)
  console.error(
    `\nFix: replace that leading space with an explicit ${BOLD}{' '}${RESET} right after the\n` +
      "closing tag — `</strong>{' '}is the top designation on` — which is the idiom\n" +
      'already used across the repo. See the header of scripts/check-jsx-spaces.mjs.\n'
  )
  process.exit(1)
}

console.log(`✓ JSX spaces: ${filesChecked} files, no entity-wrap space loss`)
process.exit(0)
