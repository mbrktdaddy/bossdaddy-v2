# scripts/

Operational tooling for Boss Daddy v2. One-off data migrations live in `_archive/` (kept for reference and audit, not for re-running).

## Active scripts

| Script | Triggered by | Purpose |
|---|---|---|
| `check-middleware-convention.mjs` | `npm predev`, `npm prebuild` | Fails the build if `middleware.ts` is created or `proxy.ts` is renamed. Next.js 16 requires `proxy.ts` — see CLAUDE.md "Middleware" section. |
| `smoke-test.mjs` | `npm run smoke` | Hits a curated list of public + protected endpoints and asserts status codes. Run before / after deploys. |
| `extract-bundle-stats.mjs` | manual | Reads the `.next/` build output and dumps the parsed/gzipped sizes of public-route chunks. Used to verify Supabase / SDK weight isn't leaking into the public bundle. |
| `list-bench-items.mjs` | manual | Diagnostic dump of `wishlist_items` rows (id, slug, status, votes). Useful for debugging the bench/admin-bench data. |
| `send-press-emails.mjs` | manual | Sends press-outreach emails from the `press_outreach` table. Pair with `/dashboard/admin/press-outreach`. |

## Untracked (decision pending)

These are sitting in `scripts/` but not yet committed. Owner is deciding fate:

- `check-legacy-slugs.mjs` — diagnostic from the slug-cleanup work
- `test-anon-legacy-query.mjs` — debug of the anonymous legacy_slugs query
- `generate-brand-kit-pdf.py` — regenerates `docs/boss-daddy-brand-kit.pdf` via reportlab

## `_archive/`

Completed one-off data migrations. Kept under git history for audit but not part of normal workflow. Do **not** re-run without checking what they did first — most expect specific DB state.

| Archived script | What it did | Roughly when |
|---|---|---|
| `backfill-images.mts` | Backfilled review/guide hero images during early image-system work | early v2 |
| `clean-slugs.mjs` | Slug-cleanup Phase 1 — generated unique slugs for legacy content | 2026-05-08 (slug Phase 1) |
| `delete-bench-placeholders.mjs` | Removed test/placeholder bench items that leaked from early seeding | mid v2 |
| `migrate-article-images.mjs` | Renamed image paths after `articles → guides` rename | post-migration 032 |
| `sweep-get-user-safe.py` | Replaced unsafe `getSession()` calls with `getUser()` across the codebase | early hardening pass |
| `upload-product-images.mjs` | One-time bulk-upload of product hero images during the products table buildout | post-migration 016 |

## Adding a new script

- **Reusable tool** (linter, smoke check, diagnostic): root level + entry in this README + `npm` script if it has a clean trigger
- **One-off data migration**: name it explicitly with what it does, run it, then `git mv` it into `_archive/` and add a row above
