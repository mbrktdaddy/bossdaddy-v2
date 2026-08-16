import { describe, it, expect } from 'vitest'
import { isDisclosureBlocked } from '@/lib/reviews'

/**
 * Audit finding #61 — the FTC affiliate disclosure gate.
 *
 * The rule itself is trivial; what these tests protect is that it stays in ONE
 * place. It was previously enforced only on create and submit, and both of the
 * paths that actually publish a review — the admin approve branch and the
 * scheduled-publish cron — reached `approved` without it. Both now call this
 * helper. If someone re-inlines the condition at a third call site and gets it
 * subtly wrong, that is the failure mode; these cases pin the semantics.
 *
 * Note the nullable columns: `has_affiliate_links` and `disclosure_acknowledged`
 * are both `boolean | null` in the schema (001_initial.sql declares them with
 * DEFAULT FALSE and no NOT NULL), so null handling is load-bearing, not academic.
 */
describe('isDisclosureBlocked', () => {
  it('blocks affiliate links with disclosure unacknowledged', () => {
    expect(isDisclosureBlocked({ has_affiliate_links: true, disclosure_acknowledged: false })).toBe(true)
  })

  it('allows affiliate links once the disclosure is acknowledged', () => {
    expect(isDisclosureBlocked({ has_affiliate_links: true, disclosure_acknowledged: true })).toBe(false)
  })

  it('allows a review with no affiliate links regardless of acknowledgement', () => {
    expect(isDisclosureBlocked({ has_affiliate_links: false, disclosure_acknowledged: false })).toBe(false)
    expect(isDisclosureBlocked({ has_affiliate_links: false, disclosure_acknowledged: true })).toBe(false)
  })

  it('treats a null acknowledgement as NOT acknowledged', () => {
    // The dangerous direction: null must never read as "acknowledged".
    expect(isDisclosureBlocked({ has_affiliate_links: true, disclosure_acknowledged: null })).toBe(true)
  })

  it('treats null affiliate-links as no affiliate links', () => {
    // Safe direction: nothing to disclose, nothing to block.
    expect(isDisclosureBlocked({ has_affiliate_links: null, disclosure_acknowledged: null })).toBe(false)
    expect(isDisclosureBlocked({ has_affiliate_links: null, disclosure_acknowledged: false })).toBe(false)
  })

  it('returns a real boolean, never a nullish value', () => {
    // Callers branch on this directly; a null/undefined leak would read falsy
    // and silently publish. Guard the type contract, not just the logic.
    const out = isDisclosureBlocked({ has_affiliate_links: null, disclosure_acknowledged: null })
    expect(typeof out).toBe('boolean')
  })
})
