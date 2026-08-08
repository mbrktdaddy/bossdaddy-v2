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
  // /goals + /goals/[id] — same category as savings: an authenticated personal
  // tracker holding medication schedules, cessation logs, and weight history.
  // The detail page is explicitly noindex. Nothing here should be shareable.
  /[\\/]goals[\\/]/,
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

/*
 * Beyond presence, three CORRECTNESS checks. Each one encodes a bug that actually
 * shipped and survived this guard, because asserting "a card exists" says nothing
 * about whether the URL resolves or the tags are complete.
 */
const HYGIENE = [
  {
    id: 'card URL under /api/',
    // Twitterbot obeys `Disallow: /api/` and ignores the more-specific
    // `Allow: /api/og` meant to override it — so a card served from /api/ is
    // silently never fetched, and the post renders with an empty image frame.
    test: (src) => /['"`]\/api\/(og|img)\b/.test(src),
    fix: 'Use OG_CARD_PATH / IMG_CROP_PATH from lib/og.ts. Never advertise a\n' +
         'generated image under /api/ — robots.txt disallows it for some crawlers.',
  },
  {
    id: 'siteUrl prefixed onto a possibly-absolute URL',
    // `${siteUrl}${row.image_url}` produced
    // "https://www.bossdaddylife.comhttps//files.cdn.printful.com/..." — a
    // nonexistent host — because the column already held an absolute URL.
    test: (src) => /\$\{\s*(siteUrl|SITE_URL|base)\s*\}\$\{[^}]*(image|Image|url|Url)[^}]*\}/.test(src),
    fix: 'Use toAbsoluteUrl(value, siteUrl) from lib/og.ts — it passes absolute\n' +
         'URLs through and only prefixes relative ones.',
  },
  {
    id: 'hand-rolled twitter block missing site/creator',
    // Next REPLACES `twitter` rather than merging, so a partial object drops the
    // layout's @bossdaddylife attribution and twitter:image.
    // Match an actual object literal (`twitter: {`), not the word "twitter:"
    // appearing in prose — comments in these files legitimately discuss
    // twitter:image and would otherwise trip every one of them.
    test: (src) => {
      for (const m of src.matchAll(/\btwitter\s*:\s*\{/g)) {
        const block = src.slice(m.index, m.index + 500)
        if (!/\bsite\s*:/.test(block) && !block.includes('TWITTER_HANDLE')) return true
      }
      return false
    },
    fix: 'Route through buildSocialMetadata(), or include site + creator:\n' +
         'TWITTER_HANDLE — Next replaces the layout\'s twitter object, never merges.',
  },
]

/**
 * Drop block comments and whole-line `//` / ` *` comments before pattern-matching.
 * These files legitimately DESCRIBE the anti-patterns being checked for — the note
 * explaining that `twitter: { card }` is wrong would otherwise flag the very page
 * that fixed it. Trailing end-of-line comments are left alone: stripping those
 * naively would eat the `//` in every https:// URL.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => {
      const t = l.trim()
      return !t.startsWith('//') && !t.startsWith('*')
    })
    .join('\n')
}

const pages = collectPages()
const missing = []
const hygiene = new Map(HYGIENE.map((h) => [h.id, []]))
let checked = 0

for (const file of pages) {
  if (ALLOW.some((re) => re.test(file))) continue
  checked++
  const src = readFileSync(file, 'utf8')
  const rel = file.replace(root, '').replace(/^[\\/]/, '').replace(/\\/g, '/')

  const hasCard =
    MARKERS.some((m) => src.includes(m)) ||
    /openGraph[\s\S]*?images\s*:/.test(src)
  if (!hasCard) missing.push(rel)

  const code = stripComments(src)
  for (const h of HYGIENE) if (h.test(code)) hygiene.get(h.id).push(rel)
}

let failed = false

if (missing.length) {
  failed = true
  console.error(`${RED}${BOLD}\n✗ OG coverage check failed${RESET}\n`)
  console.error('These public pages emit no social-preview image (og:image):\n')
  for (const f of missing) console.error(`  • ${f}`)
  console.error(
    '\nFix: route generateMetadata through buildSocialMetadata() (lib/og.ts),\n' +
      'or — if the page is private/personal and should NOT be shared — add it to\n' +
      'the ALLOW list in scripts/check-og-coverage.mjs.\n'
  )
}

for (const h of HYGIENE) {
  const hits = hygiene.get(h.id)
  if (!hits.length) continue
  failed = true
  console.error(`${RED}${BOLD}\n✗ OG hygiene: ${h.id}${RESET}\n`)
  for (const f of hits) console.error(`  • ${f}`)
  console.error(`\nFix: ${h.fix}\n`)
}

if (failed) process.exit(1)

console.log(
  `✓ OG coverage: ${checked} public pages emit a social-preview image ` +
    `(+${HYGIENE.length} hygiene checks clean)`
)
process.exit(0)
