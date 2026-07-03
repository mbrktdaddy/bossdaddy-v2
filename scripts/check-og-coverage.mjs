#!/usr/bin/env node
// Guard script: every PUBLIC, shareable page must emit a social-preview image
// (og:image / twitter:image). This is the regression guard for the link-preview
// system — it stops a newly-added page from silently shipping with the wrong
// (inherited default) card or none at all.
//
// A page "has a card" if it references buildSocialMetadata / ogImageMeta /
// ogImageUrl, or defines an openGraph block with `images`. Private, personal, or
// transactional pages (account, cart, order, personal tools) are allowlisted —
// they aren't meant to be shared and don't need a card.
//
// Runs in the prebuild hook (so Vercel/CI catch it) alongside the middleware guard.

import { readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP = join(root, 'app')

// Route groups whose page.tsx files are user-facing + shareable.
const GROUPS = ['(public)', '(tools)']

// Pages that legitimately need NO social card (private / personal / transactional).
// If you add a new page that shouldn't have a share preview, add it here.
const ALLOW = [
  /[\\/]account[\\/]/,
  /[\\/]cart[\\/]page\.tsx$/,
  /[\\/]order[\\/]/,
  /[\\/]tools[\\/]email-unsubscribe[\\/]/,
  /[\\/]tools[\\/]family[\\/]/,
  /[\\/]tools[\\/]savings[\\/]/,
]

const MARKERS = ['buildSocialMetadata', 'ogImageMeta', 'ogImageUrl']

const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function collectPages() {
  const out = []
  for (const g of GROUPS) {
    const base = join(APP, g)
    let entries
    try {
      entries = readdirSync(base, { recursive: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const p = String(e)
      if (p.endsWith('page.tsx')) out.push(join(base, p))
    }
  }
  return out
}

const pages = collectPages()
const failures = []
let checked = 0

for (const file of pages) {
  if (ALLOW.some((re) => re.test(file))) continue
  checked++
  const src = readFileSync(file, 'utf8')
  const hasCard =
    MARKERS.some((m) => src.includes(m)) ||
    /openGraph[\s\S]*?images\s*:/.test(src)
  if (!hasCard) {
    failures.push(file.replace(root, '').replace(/^[\\/]/, '').replace(/\\/g, '/'))
  }
}

if (failures.length) {
  console.error(`${RED}${BOLD}\n✗ OG coverage check failed${RESET}\n`)
  console.error('These public pages emit no social-preview image (og:image):\n')
  for (const f of failures) console.error(`  • ${f}`)
  console.error(
    '\nFix: route generateMetadata through buildSocialMetadata() (lib/og.ts),\n' +
      'or — if the page is private/personal and should NOT be shared — add it to\n' +
      'the ALLOW list in scripts/check-og-coverage.mjs.\n'
  )
  process.exit(1)
}

console.log(`✓ OG coverage: ${checked} public pages emit a social-preview image`)
process.exit(0)
