/**
 * Post-deploy smoke test — run after every production deploy.
 * Usage: npm run smoke
 *
 * Hits key endpoints and reports pass/fail. Exit code 1 if any check fails.
 */

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

const checks = [
  // Public pages — expect 200
  { label: 'Homepage',         url: '/',                    expect: 200 },
  { label: 'Reviews listing',  url: '/reviews',             expect: 200 },
  { label: 'Guides listing',   url: '/guides',              expect: 200 },
  { label: 'Gear page',        url: '/gear',                expect: 200 },
  { label: 'Wishlist page',    url: '/wishlist',            expect: 200 },

  // RSS feeds — expect 200
  { label: 'Guides RSS feed',  url: '/feed/guides.xml',     expect: 200 },
  { label: 'Reviews RSS feed', url: '/feed/reviews.xml',    expect: 200 },

  // Legacy redirects — expect 301
  { label: '/articles redirect',     url: '/articles',          expect: 301 },
  { label: '/feed/articles redirect', url: '/feed/articles.xml', expect: 301 },

  // Auth-gated — expect 307 redirect to /login (not 500)
  { label: 'Dashboard redirect', url: '/dashboard', expect: 307 },

  // Cron — no secret, expect 401 (not 500 or fail-open 200)
  { label: 'Cron auth guard', url: '/api/cron/publish-scheduled', expect: 401 },
]

let passed = 0
let failed = 0

for (const { label, url, expect } of checks) {
  try {
    const res = await fetch(`${BASE}${url}`, { redirect: 'manual' })
    const ok = res.status === expect
    const icon = ok ? '✓' : '✗'
    const detail = ok ? '' : ` (got ${res.status})`
    console.log(`  ${icon}  ${label}${detail}`)
    if (ok) { passed++ } else { failed++ }
  } catch (err) {
    console.log(`  ✗  ${label} — fetch error: ${err.message}`)
    failed++
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
