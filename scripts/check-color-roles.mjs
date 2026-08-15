#!/usr/bin/env node
// Guards the role-token contract in app/globals.css: every colour role belongs to
// ONE utility family, and using it in another family silently renders the wrong
// thing rather than failing.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE BUG THIS EXISTS FOR (found 2026-08-15, from a user report that help text
// was unreadable)
//
//   className="text-xs text-faint"
//
// `text-faint` looks like the faint TEXT tier. It isn't. `--color-faint` is the
// faint BORDER tier (`--bd-border-faint: #1f1f23`), so that paragraph rendered
// #1f1f23 on a #18181b card — about 1.1:1, effectively invisible. The faint text
// token is `--color-prose-faint` (#a1a1aa), which the A11y audit had already
// raised from zinc-500 to clear 4.5:1. The fix landed in the token and never
// reached the markup, because the markup was pointing at a different token.
//
// Its twin is quieter and was in 85 places: `text-muted` matches NO token at all,
// so Tailwind emits no class and the element inherits full-brightness body text.
// It looks fine, so nobody notices that the de-emphasis never happened.
//
// Both are invisible to a code reviewer, to `tsc`, and to ESLint's raw-shade rule
// (which only bans `text-zinc-400`-style literals). Hence a build guard.
//
// WHY NOT JUST READ THE TOKENS AND FLAG UNKNOWN SUFFIXES: because `text-xs`,
// `text-center` and `text-balance` are all legitimate non-colour utilities, so
// "suffix isn't a colour" proves nothing.
//
// WHY THIS ONLY POLICES `text-*`, AND ONLY AGAINST TWO CATEGORIES:
// A first cut enforced a full role → family contract in both directions and
// produced 149 hits, most of them CORRECT code. Using a text tier as a fill or a
// border is a real pattern — `bg-prose text-surface` is how an inverted message
// bubble is built (near-white fill, dark ink), and `bg-soft` is a legitimate
// hairline. Flagging those would have meant either 90 wrong "fixes" or a guard
// nobody trusts.
//
// What IS unambiguous: text painted with a BORDER tier, and text painted with a
// token that doesn't exist. Nobody intends body copy at #1f1f23 on a #18181b card,
// and nobody intends a class that emits nothing. Surface roles as text stay
// allowed — that's inversion, and the system has no other token for it.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOTS = ['app', 'components', 'lib', 'emails']
const EXTS = new Set(['.tsx', '.ts', '.jsx', '.js'])

// The EDGE roles from app/globals.css. These are hairline colours a step or two
// off the surface they sit on — as text they range from unreadable to invisible.
const EDGE_ROLES = ['faint', 'soft', 'strong']

// Suffixes that read like a role and are not one. Tailwind emits no class, so the
// element silently inherits full-brightness body colour and the intended
// de-emphasis never happens. Invisible in review precisely because it looks fine.
const PHANTOM_ROLES = { 'muted': 'prose-muted' }

// Every role name whose existence this guard depends on.
const REQUIRED_TOKENS = [...EDGE_ROLES, 'prose', 'prose-muted', 'prose-faint']

const SUGGESTION = {
  faint:  'text-prose-faint',
  soft:   'text-prose-muted',
  strong: 'text-prose',
  muted:  'text-prose-muted',
}

const PATTERN = /\btext-([a-z][a-z0-9-]*)\b/g

// ── the token list must still exist, or this guard is checking a fiction ──────
const css = readFileSync('app/globals.css', 'utf8')
const declared = new Set(
  [...css.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]),
)
const missing = REQUIRED_TOKENS.filter((role) => !declared.has(role))
if (missing.length) {
  console.error(
    `✖ Colour roles ${missing.join(', ')} are no longer declared as --color-* in ` +
    `app/globals.css.\n  Either the token was renamed (update EDGE_ROLES / ` +
    `REQUIRED_TOKENS in this script) or it was dropped (update the markup).`,
  )
  process.exit(1)
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else if (EXTS.has(extname(path))) out.push(path)
  }
  return out
}

const files = ROOTS.flatMap((root) => {
  try { return walk(root) } catch { return [] }
})

const problems = []

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const [, suffix] of line.matchAll(PATTERN)) {
      if (EDGE_ROLES.includes(suffix)) {
        problems.push({
          file, line: i + 1, used: `text-${suffix}`, suggestion: SUGGESTION[suffix],
          why: `\`${suffix}\` is a BORDER tier (--color-${suffix}); as text it is a hairline colour on its own surface`,
        })
      } else if (PHANTOM_ROLES[suffix]) {
        problems.push({
          file, line: i + 1, used: `text-${suffix}`, suggestion: SUGGESTION[suffix],
          why: `no --color-${suffix} token exists, so this emits nothing and inherits body colour`,
        })
      }
    }
  })
}

if (problems.length) {
  console.error(`✖ ${problems.length} colour-role misuse${problems.length === 1 ? '' : 's'}:\n`)
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}  ${p.used} → ${p.suggestion}`)
    console.error(`      ${p.why}`)
  }
  console.error(
    '\n  These compile and pass lint. They render the wrong colour or no colour at all.',
  )
  process.exit(1)
}

console.log(
  `✓ Colour roles: ${files.length} files scanned, no text painted with a border tier or a phantom token`,
)
