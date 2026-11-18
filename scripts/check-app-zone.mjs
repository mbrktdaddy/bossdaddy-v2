#!/usr/bin/env node
// STRICT guard for the Toolbox scheme (brand-guide §11, 2026-11-13).
//
// The Toolbox routes — /tools, /goals, /today, /account — render inside a dark
// app canvas (components/app/AppZone.tsx). Chrome black is #09090b and VANISHES
// there: a `bg-chrome` panel is a black box on a black page, a `border-chrome`
// edge is an invisible line, and a hand-set grey is a colour tuned for the white
// page. The scheme's rule is "add the `app:` form beside the light class, never
// remove the light class" (`app:bg-surface-raised`, `app:border-strong`, a role
// token). Nothing enforces that: tsc, ESLint and the Hard Goods ratchet all pass
// a black panel that nobody can see. The next feature copies whichever neighbour
// it opened first, so this fails the build on the first one.
//
// RULES (per class line, comments stripped):
//   A1  `bg-chrome` with no opacity suffix and no `app:bg-` on the line.
//       (`bg-chrome/60` is a scrim and reads fine on any canvas.)
//   A2  `border-chrome` with no `app:border-` on the line.
//   A3  a raw palette class — zinc/neutral/gray/slate/stone shades, `bg-white`,
//       `bg-black`, `text-black` — with no `app:` on the line. Tokens only.
//
// SCOPE: the four route folders, plus the component folders only the app renders.
// Shared primitives (Card, UtilityBox, ToolCard, PageHeader, LabelBlock, Notice)
// carry their app forms internally and are consumed by props, so they do not
// trip this. A component used on BOTH canvases needs both forms on one line —
// that is the rule, not an exception.
//
// No baseline on purpose: the scheme shipped clean on day one (2026-11-13), and a
// ratchet only makes sense for a migration. `npm run check:app-zone`.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const ROOTS = [
  'app/(public)/tools',
  'app/(public)/goals',
  'app/(public)/today',
  'app/(public)/account',
  'components/dad-tools',
  'components/goals',
  'components/account',
  'components/notifications',
  'components/pwa',
  'components/app',
]

const RULES = [
  { id: 'A1', name: 'chrome fill on the dark canvas', hit: /\bbg-chrome\b(?!\/)/, ok: /\bapp:bg-/ },
  { id: 'A2', name: 'chrome edge on the dark canvas', hit: /\bborder-chrome\b/, ok: /\bapp:border-/ },
  {
    id: 'A3',
    name: 'hand-set grey, black or white (tokens only)',
    hit: /\b(?:bg|text|border|divide|ring|stroke|fill)-(?:zinc|neutral|gray|slate|stone)-\d{2,3}\b|\bbg-white\b(?!\/)|\bbg-black\b(?!\/)|\btext-black\b/,
    ok: /\bapp:/,
  },
]

const HINT = {
  A1: 'add `app:bg-surface-raised` (a panel) or `app:bg-surface` (the deck) beside `bg-chrome`',
  A2: 'add `app:border-strong` (an edge) or `app:border-prose` (a header rule) beside `border-chrome`',
  A3: 'use a role token (bg-surface-hover, text-prose-faint, bg-chrome/55 …)',
}

function walk(dir, out) {
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name)) out.push(full)
  }
  return out
}

// Source lines with comments removed: line comments to end of line, inline block
// comments, and block comments spanning lines (tracked with `inBlock`).
function codeLines(src) {
  const out = []
  let inBlock = false
  for (const raw of src.split('\n')) {
    let line = raw
    if (inBlock) {
      const end = line.indexOf('*/')
      if (end === -1) { out.push(''); continue }
      line = line.slice(end + 2)
      inBlock = false
    }
    // Inline block comments, possibly several.
    line = line.replace(/\/\*[\s\S]*?\*\//g, '')
    const open = line.indexOf('/*')
    if (open !== -1) { line = line.slice(0, open); inBlock = true }
    // Line comments: `//` at the start or after whitespace (keeps `https://`).
    line = line.replace(/(^|\s)\/\/.*$/, '$1')
    out.push(line)
  }
  return out
}

const files = ROOTS.flatMap((r) => walk(join(ROOT, r), []))
const hits = []
for (const file of files) {
  const lines = codeLines(readFileSync(file, 'utf8'))
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.hit.test(line) && !rule.ok.test(line)) {
        hits.push({ file: relative(ROOT, file).replace(/\\/g, '/'), line: i + 1, rule: rule.id, text: line.trim().slice(0, 110) })
      }
    }
  })
}

if (hits.length === 0) {
  console.log(`✓ App zone: ${files.length} files scanned, no chrome fill, chrome edge or hand-set grey without an app form`)
  process.exit(0)
}

console.error(`\n✖ App zone: ${hits.length} hit(s) — a light-page class inside the Toolbox routes with no \`app:\` form beside it (brand-guide §11)\n`)
for (const h of hits) {
  console.error(`  ${h.file}:${h.line}  ${h.rule}  ${h.text}`)
}
console.error('')
for (const rule of RULES) {
  if (hits.some((h) => h.rule === rule.id)) console.error(`  ${rule.id} ${rule.name}: ${HINT[rule.id]}`)
}
console.error('\n  The rule is "add the app form, never remove the light class" — the same component may render on the white page.\n')
process.exit(1)
