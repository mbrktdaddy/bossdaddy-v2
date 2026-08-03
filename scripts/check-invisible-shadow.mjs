// Fails the build on `shadow-black/*` — a shadow that cannot render on this
// dark-first app.
//
// The canvas is `--bd-bg: #09090b` and the card surface is `--bd-surface: #18181b`.
// A black shadow at 5–10% alpha over near-black is not "subtle", it is *nothing*: the
// composite is indistinguishable from the surface it falls on. brand-guide §2 states
// the rule — elevation comes from borders and raised surfaces, never shadows.
//
// Why a guard and not just a cleanup: the pattern reached 63 occurrences across 46
// files because the brand guide's own canonical card skeleton (§6) *taught* it. Every
// new card was copied from a documented example carrying
// `shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-black/10`. The skeleton is
// fixed now, but a doc fix can't stop a copy-paste from an existing component — so the
// build has to.
//
// ALLOWED, because these do render on a dark canvas:
//   shadow-orange-950/25, shadow-zinc-900/40   — BossApprovedBadge, colour-tinted
//   shadow-accent/30                            — MobileBottomNav, an accent glow
//   shadow-[0_0_10px_rgba(229,90,26,0.7)]       — BenchStrip's pulsing dot, orange glow
// If you want elevation on dark, that is the move: a COLOURED glow, not black.
//
// KNOWN GAP, deliberately not enforced: bare `shadow-sm|md|lg|xl|2xl` with no colour
// override uses Tailwind's default black-based shadow and is equally invisible. Those
// survive on ~20 overlay surfaces (modals, dropdowns, lightboxes, toasts), which sit
// above a backdrop scrim that already separates them, and which are mostly admin
// surfaces. Sweeping them is a separate call with no visual gain; this guard covers the
// explicit anti-pattern only. The count is reported below so a future pass has a
// starting point.

import { readFileSync, globSync } from 'node:fs'

const FILES = globSync(['app/**/*.tsx', 'components/**/*.tsx', 'lib/**/*.tsx']).filter(
  (p) => !p.includes('node_modules') && !p.includes('_archive'),
)

const BANNED = /shadow-black\/\d+/g
// Prose that MENTIONS the pattern — this file's own docs, and the design notes left in
// CredibilityBreak / LibraryGuideCard explaining why it was removed.
const isProse = (line) => /^\s*(\/\/|\*|\/\*)/.test(line) || /`shadow-/.test(line)
const BARE = /(?<![-\w/])shadow-(?:sm|md|lg|xl|2xl)\b/g

const offenders = []
let bareCount = 0
const bareFiles = new Set()

for (const file of FILES) {
  const src = readFileSync(file, 'utf8')
  src.split('\n').forEach((line, i) => {
    if (isProse(line)) return
    for (const m of line.matchAll(BANNED)) {
      offenders.push({ file, line: i + 1, token: m[0], text: line.trim().slice(0, 120) })
    }
    const bare = line.match(BARE)
    if (bare) {
      bareCount += bare.length
      bareFiles.add(file)
    }
  })
}

if (offenders.length > 0) {
  console.error(`\n✖ Invisible shadow: ${offenders.length} occurrence(s) of shadow-black/*\n`)
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}  ${o.token}`)
    console.error(`    ${o.text}`)
  }
  console.error(`
  A black shadow does not render on a #09090b canvas. Use the documented elevation
  instead — 'border border-soft' plus 'hover:border-accent' and a small
  'hover:-translate-y-0.5' lift. If you genuinely want a glow, tint it:
  'shadow-[0_0_10px_rgba(229,90,26,0.7)]' like BenchStrip's live dot.
  See docs/brand-guide.md §2 and §6.
`)
  process.exit(1)
}

console.log(
  `✓ Invisible shadow: ${FILES.length} files scanned, no shadow-black/* ` +
    `(${bareCount} bare shadow-* remain on ${bareFiles.size} overlay surfaces — see this script's header)`,
)
