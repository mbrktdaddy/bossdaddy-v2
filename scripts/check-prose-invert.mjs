// Fails the build if a Tailwind Typography `prose` block on this dark-first app
// neither inverts nor sets an explicit heading colour.
//
// Guards the 2026-08-02 invisible-headings bug. Tailwind Typography's colour
// modifiers ship a LIGHT-mode variable set by default: `prose-zinc` sets
//
//   --tw-prose-headings: zinc-900  ->  #18181b
//
// and this app's dark surface is `--bd-surface: #18181b` (app/globals.css:86).
// Byte-identical. Headings don't render dim, they render *perfectly invisible* —
// same colour as the panel behind them.
//
// It hid for so long because it is silent and partial. Every other element in a
// typical class list already carries an explicit override (`prose-p:text-prose-muted`,
// `prose-strong:text-prose`, `prose-a:…`), so body copy, bold and links all look
// right. Headings were the one element given font/size/tracking but never a colour,
// so they alone fell through to the light-mode default. Nothing errors, nothing
// warns, and the author's own H2s just aren't there — which is exactly how the
// guide/review body editor shipped unusable.
//
// TWO accepted fixes, because both are legitimate:
//   1. `prose-invert`            — flips the whole variable set (headings, captions,
//                                  bullet markers, code, hr) in one token. Preferred:
//                                  it also fixes the elements nobody remembered.
//   2. `prose-headings:text-…`   — or per-level `prose-h2:text-…` / `prose-h3:text-…`.
//                                  What /how-we-test does, and it is genuinely fine.
//
// Deliberately a string check over string literals, not a JSX/Tailwind parse: class
// lists here appear as plain attributes, as multi-line template literals, and as
// arrays of strings joined at runtime (components/workspace/TiptapEditor.tsx). A
// literal-level scan catches all three without pretending to understand JSX.

import { readFileSync, globSync } from 'node:fs'

const FILES = globSync(['app/**/*.tsx', 'components/**/*.tsx', 'lib/**/*.tsx']).filter(
  (p) => !p.includes('node_modules') && !p.includes('_archive'),
)

// The bare base class. Lookarounds keep `prose-zinc`, `text-prose` and
// `--color-prose` from matching — only the standalone `prose` token counts.
const BARE_PROSE     = /(?<![\w-])prose(?![\w-])/
const HAS_INVERT     = /(?<![\w-])prose-invert(?![\w-])/
const HEADING_COLOUR = /(?<![\w-])prose-(?:headings|h1|h2|h3|h4):text-/

// A literal has to look like a utility class list before we judge it, so the word
// "prose" sitting in an error message or a label can't trip the guard.
const LOOKS_LIKE_CLASSES = /(?<![\w-])(?:prose-[a-z]|max-w-|mx-auto|text-\w)/

// Backstop against a desynced scan. A real class list never contains an angle
// bracket, but a blob that swallowed JSX text always does. Arbitrary values
// (`max-w-[68ch]`, `grid-cols-[1fr_280px]`) and `${…}` interpolation are fine —
// only `<`/`>` are rejected, so an interpolated class string still gets checked.
const SWALLOWED_JSX = /[<>]/

/**
 * Positions of every string / template literal, skipping comments so a prose
 * mention in a doc block can't be mistaken for a class list. Template literals
 * are taken whole (interpolations included) — good enough for class blobs, and
 * it avoids mis-parsing nested quotes.
 */
function scanLiterals(src) {
  const out = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    // An apostrophe in JSX text (`Don't`) is not a string opener, and treating it
    // as one desyncs the whole scan — the blob runs on through real markup and
    // swallows unrelated class attributes. So a quote only opens a literal where
    // one can legally begin: after `=`, an opening bracket, or an operator. In JSX
    // prose an apostrophe follows a word character, which fails this test.
    if (c === '"' || c === "'" || c === '`') {
      const prev = src.slice(0, i).replace(/\s+$/, '').slice(-1)
      if (prev && !'=([{,:;+&|?!<>`'.includes(prev)) { i++; continue }
      const quote = c
      const start = ++i
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue }
        if (src[i] === quote) break
        i++
      }
      out.push({ start, end: i, text: src.slice(start, i) })
      i++
      continue
    }
    i++
  }
  return out
}

const violations = []

for (const file of FILES) {
  const src = readFileSync(file, 'utf8')
  if (!BARE_PROSE.test(src)) continue

  const literals = scanLiterals(src)

  for (let n = 0; n < literals.length; n++) {
    const lit = literals[n]
    if (!BARE_PROSE.test(lit.text)) continue
    if (!LOOKS_LIKE_CLASSES.test(lit.text)) continue
    if (SWALLOWED_JSX.test(lit.text)) continue

    // Widen to the whole class region: keep absorbing following literals while
    // only separators sit between them. This is what makes an array of class
    // strings (`['prose prose-zinc', 'prose-headings:…'].join(' ')`) read as one
    // list instead of N unrelated fragments.
    let region = lit.text
    let end = lit.end
    for (let m = n + 1; m < literals.length; m++) {
      const gap = src.slice(end + 1, literals[m].start - 1)
      if (!/^[\s,+]*$/.test(gap)) break
      region += ' ' + literals[m].text
      end = literals[m].end
      n = m
    }

    if (HAS_INVERT.test(region) || HEADING_COLOUR.test(region)) continue

    violations.push({
      file,
      line: src.slice(0, lit.start).split('\n').length,
      snippet: lit.text.replace(/\s+/g, ' ').trim().slice(0, 72),
    })
  }
}

if (violations.length) {
  console.error('\n✖ `prose` block with no heading colour on a dark surface:\n')
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  "${v.snippet}…"`)
  }
  console.error(
    '\n  Tailwind Typography\'s colour modifiers default to a LIGHT variable set, so' +
      '\n  --tw-prose-headings is zinc-900 (#18181b) — the same value as this app\'s dark' +
      '\n  --bd-surface. Headings render invisible, not dim. Body copy still looks correct' +
      '\n  because prose-p / prose-strong / prose-a are usually overridden by hand, which' +
      '\n  is precisely why this is easy to ship and hard to notice.' +
      '\n' +
      '\n  Fix with either:' +
      '\n    prose prose-zinc prose-invert …        <- preferred; also fixes captions,' +
      '\n                                              bullet markers, code and hr' +
      '\n    prose-headings:text-prose …            <- explicit per-element override\n',
  )
  process.exit(1)
}

console.log(`✓ Prose heading contrast: ${FILES.length} files scanned, every prose block inverts or sets a heading colour`)
