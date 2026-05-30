/**
 * Smoke test for transformFollowupContent — the pure HTML transform that wraps
 * the 4 required follow-up headings in <details> blocks and emits a TOC list.
 *
 * Run: npx tsx scripts/_archive/test-followup-transform.ts
 */
import { transformFollowupContent } from '../../lib/reviews'

interface Case {
  name: string
  input: string
  expect: (out: { html: string; toc: { label: string; anchor: string }[] }) => string | null
}

const cases: Case[] = [
  {
    name: 'empty input returns empty html and empty toc',
    input: '',
    expect: ({ html, toc }) => (html === '' && toc.length === 0 ? null : `html=${html} toc=${toc.length}`),
  },
  {
    name: 'no h2 returns unchanged html and empty toc',
    input: '<p>just a paragraph</p>',
    expect: ({ html, toc }) =>
      html === '<p>just a paragraph</p>' && toc.length === 0 ? null : `html=${html}`,
  },
  {
    name: 'one required heading wraps in <details> and adds TOC entry',
    input: '<h2>What changed</h2><p>body</p>',
    expect: ({ html, toc }) => {
      if (toc.length !== 1) return `expected toc.length=1, got ${toc.length}`
      if (toc[0].label !== 'What changed') return `wrong label: ${toc[0].label}`
      if (toc[0].anchor !== 'what-changed') return `wrong anchor: ${toc[0].anchor}`
      if (!html.startsWith('<details open id="what-changed"')) return `no details wrap: ${html.slice(0, 80)}`
      if (!html.includes('<h2 style="margin:0">What changed</h2>')) return `h2 missing/wrong: ${html.slice(0, 200)}`
      if (!html.includes('<p>body</p></details>')) return `body not inside details: ${html}`
      return null
    },
  },
  {
    name: 'all 4 required + 1 non-required → wraps 4, leaves 1, toc=4',
    input: [
      '<p>intro</p>',
      '<h2>What changed</h2><p>a</p>',
      '<h2>What I got wrong</h2><p>b</p>',
      '<h2>Would I buy it again</h2><p>c</p>',
      '<h2>Photo update</h2><p>d</p>',
      '<h2>Side note</h2><p>e</p>',
    ].join(''),
    expect: ({ html, toc }) => {
      if (toc.length !== 4) return `toc.length=${toc.length}, expected 4`
      const detailsCount = (html.match(/<details open id="/g) ?? []).length
      if (detailsCount !== 4) return `details count=${detailsCount}, expected 4`
      if (!html.includes('<h2 id="side-note">Side note</h2>')) return 'side-note not passed through as plain h2'
      if (!html.startsWith('<p>intro</p>')) return 'intro lost'
      return null
    },
  },
  {
    name: 'case-insensitive matching — "WHAT CHANGED" still matches',
    input: '<h2>WHAT CHANGED</h2><p>x</p>',
    expect: ({ toc }) => (toc.length === 1 && toc[0].label === 'WHAT CHANGED' ? null : `toc=${JSON.stringify(toc)}`),
  },
  {
    name: 'heading with inline markup — strips for matching, keeps escaped text in output',
    // sanitizer typically strips <strong> from h2 but defend anyway
    input: '<h2><strong>What changed</strong></h2><p>x</p>',
    expect: ({ html, toc }) => {
      if (toc.length !== 1) return `toc.length=${toc.length}`
      // we strip tags for label matching AND for display — output shouldn't contain <strong>
      if (html.includes('<strong>')) return 'inner <strong> leaked into display'
      return null
    },
  },
  {
    name: 'unrecognized heading gets anchor id but no <details> wrap',
    input: '<h2>Custom Section</h2><p>x</p>',
    expect: ({ html, toc }) => {
      if (toc.length !== 0) return `toc.length=${toc.length}, expected 0`
      if (!html.startsWith('<h2 id="custom-section">')) return `no anchor on plain h2: ${html.slice(0, 80)}`
      if (html.includes('<details')) return 'unexpected <details> wrap'
      return null
    },
  },
  {
    name: 'h2 with existing attributes — attributes discarded (we emit fresh h2)',
    input: '<h2 class="foo" id="bar">What changed</h2><p>x</p>',
    expect: ({ html }) => {
      if (html.includes('class="foo"')) return 'old class leaked'
      if (!html.includes('<details open id="what-changed"')) return 'new anchor not applied'
      return null
    },
  },
]

let passed = 0
let failed = 0
const failures: string[] = []

for (const c of cases) {
  const result = transformFollowupContent(c.input)
  const failure = c.expect(result)
  if (failure === null) {
    passed++
    console.log(`  ✓ ${c.name}`)
  } else {
    failed++
    failures.push(`${c.name}\n      → ${failure}`)
    console.log(`  ✗ ${c.name}`)
    console.log(`      → ${failure}`)
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
