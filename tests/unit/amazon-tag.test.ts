import { describe, it, expect } from 'vitest'
import {
  appendAmazonTag,
  extractAsin,
  isValidAsin,
  buildAmazonAffiliateUrl,
} from '@/lib/amazon-tag'

// C3 money-path guard. The affiliate tag is how the site earns — these lock in
// the "tag actually gets stamped, and only onto Amazon" contract.
describe('appendAmazonTag', () => {
  it('stamps the tag onto a bare Amazon product URL', () => {
    const out = appendAmazonTag('https://www.amazon.com/dp/B0ABCDEFGH', 'bossdaddy-20')
    expect(new URL(out).searchParams.get('tag')).toBe('bossdaddy-20')
  })

  it('matches Amazon international TLDs (co.uk, ca, …)', () => {
    expect(new URL(appendAmazonTag('https://www.amazon.co.uk/dp/B0ABCDEFGH', 't-21')).searchParams.get('tag')).toBe('t-21')
    expect(new URL(appendAmazonTag('https://amazon.ca/dp/B0ABCDEFGH', 't-20')).searchParams.get('tag')).toBe('t-20')
  })

  it('does NOT overwrite an existing tag', () => {
    const url = 'https://www.amazon.com/dp/B0ABCDEFGH?tag=someone-else-20'
    expect(appendAmazonTag(url, 'bossdaddy-20')).toBe(url)
  })

  it('leaves non-Amazon destinations untouched', () => {
    const url = 'https://www.target.com/p/stroller'
    expect(appendAmazonTag(url, 'bossdaddy-20')).toBe(url)
  })

  it('does not stamp a lookalike host (amazon.evil.com)', () => {
    const url = 'https://amazon.evil.com/dp/B0ABCDEFGH'
    expect(appendAmazonTag(url, 'bossdaddy-20')).toBe(url)
  })

  it('returns the URL unchanged when the tag is empty (the C3 failure mode)', () => {
    const url = 'https://www.amazon.com/dp/B0ABCDEFGH'
    expect(appendAmazonTag(url, '')).toBe(url)
  })

  it('returns malformed input unchanged instead of throwing', () => {
    expect(appendAmazonTag('not a url', 'bossdaddy-20')).toBe('not a url')
  })
})

describe('extractAsin', () => {
  it.each([
    ['https://www.amazon.com/dp/B0ABCDEFGH', 'B0ABCDEFGH'],
    ['https://www.amazon.com/dp/B0ABCDEFGH/some-slug', 'B0ABCDEFGH'],
    ['https://www.amazon.com/gp/product/B0ABCDEFGH', 'B0ABCDEFGH'],
    ['https://www.amazon.com/gp/aw/d/B0ABCDEFGH', 'B0ABCDEFGH'],
    ['https://www.amazon.com/exec/obidos/asin/B0ABCDEFGH', 'B0ABCDEFGH'],
    ['https://www.amazon.com/dp/B0ABCDEFGH?ref=foo', 'B0ABCDEFGH'],
  ])('pulls the ASIN from %s', (url, asin) => {
    expect(extractAsin(url)).toBe(asin)
  })

  it('uppercases a lowercased ASIN in the path', () => {
    expect(extractAsin('https://www.amazon.com/dp/b0abcdefgh')).toBe('B0ABCDEFGH')
  })

  it('returns null for non-Amazon hosts', () => {
    expect(extractAsin('https://www.walmart.com/dp/B0ABCDEFGH')).toBeNull()
  })

  it('returns null when no ASIN is present', () => {
    expect(extractAsin('https://www.amazon.com/gp/cart')).toBeNull()
  })

  it('returns null for malformed input', () => {
    expect(extractAsin('garbage')).toBeNull()
  })
})

describe('isValidAsin', () => {
  it('accepts a canonical 10-char ASIN', () => {
    expect(isValidAsin('B0ABCDEFGH')).toBe(true)
  })
  it('normalizes case and whitespace', () => {
    expect(isValidAsin('  b0abcdefgh  ')).toBe(true)
  })
  it('rejects wrong-length or non-alphanumeric values', () => {
    expect(isValidAsin('B0ABCDEFG')).toBe(false)   // 9 chars
    expect(isValidAsin('B0ABCDEFGHI')).toBe(false)  // 11 chars
    expect(isValidAsin('B0-BCDEFGH')).toBe(false)   // hyphen
  })
})

describe('buildAmazonAffiliateUrl', () => {
  it('builds a canonical tag-stamped /dp/ URL', () => {
    expect(buildAmazonAffiliateUrl('b0abcdefgh', 'bossdaddy-20')).toBe(
      'https://www.amazon.com/dp/B0ABCDEFGH?tag=bossdaddy-20',
    )
  })
})
