import { describe, it, expect } from 'vitest'
import { rewritePublicLegacy, rewriteLegacyRoute } from '@/lib/proxy/rewrites'

// Redirect-coverage guardrail for the rename surface (audit Phase 2).
//
// The 4 public concept renames (/articles→/guides, /wishlist→/bench,
// /shop+/stuff→/gear, /tools/kids→/tools/family) must keep 301-ing ~forever —
// hard-resetting them costs SEO equity + breaks inbound/affiliate links.
// This locks every documented mapping so an accidental edit to rewrites.ts
// (or a "cleanup" that drops a case) fails CI instead of silently 404-ing
// crawlers and old bookmarks. If a mapping is *intentionally* changed, update
// the table below in the same commit.

describe('rewritePublicLegacy — public 301s (fire for logged-out users too)', () => {
  it.each([
    // /shop → /gear
    ['/shop', '/gear'],
    ['/shop/', '/gear'],
    ['/shop/t-shirts', '/gear'],
    // /stuff → /gear (subpaths preserved)
    ['/stuff', '/gear'],
    ['/stuff/', '/gear'],
    ['/stuff/strollers', '/gear/strollers'],
    // RSS feed rename
    ['/feed/articles.xml', '/feed/guides.xml'],
    // /wishlist → /bench
    ['/wishlist', '/bench'],
    ['/wishlist/', '/bench'],
    ['/wishlist/uppababy-vista', '/bench/uppababy-vista'],
    // /tools/kids → /tools/family
    ['/tools/kids', '/tools/family'],
    ['/tools/kids/', '/tools/family'],
    ['/tools/kids/oldest', '/tools/family/oldest'],
  ])('%s → %s', (from, to) => {
    expect(rewritePublicLegacy(from)).toBe(to)
  })

  it.each([
    '/gear',
    '/bench',
    '/guides',
    '/tools/family',
    '/reviews/some-product',
    '/feed/guides.xml',
    '/',
  ])('leaves canonical path %s alone', (path) => {
    expect(rewritePublicLegacy(path)).toBeNull()
  })
})

describe('rewriteLegacyRoute — /articles + workspace consolidation', () => {
  it.each([
    // Public /articles → /guides
    ['/articles', '/guides'],
    ['/articles/best-diaper-bags', '/guides/best-diaper-bags'],
    // Dashboard /articles → /guides
    ['/dashboard/articles', '/dashboard/guides'],
    ['/dashboard/articles/123/edit', '/dashboard/guides/123/edit'],
    // Admin shop → merch
    ['/dashboard/admin/shop', '/dashboard/admin/merch'],
    ['/dashboard/admin/shop/blanks', '/dashboard/admin/merch/blanks'],
    // Edit routes fold into the unified workspace
    ['/dashboard/guides/abc/edit', '/dashboard/guides/abc'],
    ['/dashboard/reviews/abc/edit', '/dashboard/reviews/abc'],
    // Moderation folds into the workspace
    ['/dashboard/moderation/articles/xyz', '/dashboard/guides/xyz'],
    ['/dashboard/moderation/xyz', '/dashboard/reviews/xyz'],
    ['/dashboard/moderation', '/dashboard'],
    ['/dashboard/moderation/', '/dashboard'],
  ])('%s → %s', (from, to) => {
    expect(rewriteLegacyRoute(from)).toBe(to)
  })

  it.each([
    '/guides',
    '/dashboard/guides',
    '/dashboard/reviews/abc',
    '/dashboard/admin/merch',
    '/dashboard',
  ])('leaves canonical path %s alone', (path) => {
    expect(rewriteLegacyRoute(path)).toBeNull()
  })
})
