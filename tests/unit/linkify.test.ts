// Linkification runs over text ANOTHER MEMBER wrote, so the security cases below
// are not hypothetical — they're the reason this is a tokenizer instead of a string
// of HTML. The boundary cases matter for a different reason: a link that swallows
// the sentence's full stop is a link that 404s.

import { describe, it, expect } from 'vitest'
import { tokenizeLinks, type TextToken } from '@/lib/linkify'

const links = (input: string) =>
  tokenizeLinks(input).filter((t): t is Extract<TextToken, { type: 'link' }> => t.type === 'link')

/** The rendered text, to prove nothing is dropped or duplicated. */
const flatten = (input: string) =>
  tokenizeLinks(input).map((t) => t.type === 'text' ? t.value : t.label).join('')

describe('tokenizeLinks — the basics', () => {
  it('returns nothing for empty input', () => {
    expect(tokenizeLinks('')).toEqual([])
  })

  it('leaves plain text as a single token', () => {
    const out = tokenizeLinks('no links in here at all')
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ type: 'text', value: 'no links in here at all' })
  })

  it('finds an http and an https URL', () => {
    expect(links('go to https://example.com now')[0].href).toBe('https://example.com/')
    expect(links('go to http://example.com now')[0].href).toBe('http://example.com/')
  })

  it('gives a bare www. host a scheme', () => {
    expect(links('try www.example.com')[0].href).toBe('https://www.example.com/')
  })

  it('keeps the surrounding prose intact', () => {
    const out = tokenizeLinks('before https://example.com after')
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual({ type: 'text', value: 'before ' })
    expect(out[2]).toEqual({ type: 'text', value: ' after' })
  })

  it('handles several links in one message', () => {
    expect(links('https://a.com and https://b.com and https://c.com')).toHaveLength(3)
  })
})

describe('tokenizeLinks — where the URL actually ends', () => {
  // The single most common real-world case: a link at the end of a sentence.
  it('does not swallow a trailing full stop', () => {
    const out = tokenizeLinks('look at https://example.com/page.')
    expect(links('look at https://example.com/page.')[0].label).toBe('https://example.com/page')
    expect(out.at(-1)).toEqual({ type: 'text', value: '.' })
  })

  it('does not swallow other sentence punctuation', () => {
    for (const p of [',', ';', ':', '!', '?', '"', "'"]) {
      expect(links(`see https://example.com${p} ok`)[0].label).toBe('https://example.com')
    }
  })

  // A closing bracket can belong to EITHER the URL or the writer, and only the
  // balance tells you which.
  it('keeps a bracket the URL itself opened', () => {
    expect(links('https://en.wikipedia.org/wiki/Boss_(disambiguation)')[0].label)
      .toBe('https://en.wikipedia.org/wiki/Boss_(disambiguation)')
  })

  it('drops a bracket the writer opened', () => {
    expect(links('(https://example.com)')[0].label).toBe('https://example.com')
  })

  it('strips several trailing characters at once', () => {
    expect(links('really? https://example.com/x").')[0].label).toBe('https://example.com/x')
  })
})

describe('tokenizeLinks — security', () => {
  // The gate that has to hold. An anchor with a javascript: href is script
  // execution on click, arriving from another member's message.
  it('never produces a javascript: link', () => {
    expect(links('javascript:alert(1)')).toHaveLength(0)
    expect(links('JaVaScRiPt:alert(1)')).toHaveLength(0)
  })

  it('never produces a data: or file: link', () => {
    expect(links('data:text/html,<script>alert(1)</script>')).toHaveLength(0)
    expect(links('file:///etc/passwd')).toHaveLength(0)
  })

  // Markup in a body must survive as literal characters — proving the tokenizer
  // hands text through untouched rather than interpreting it.
  it('treats markup as text, not markup', () => {
    const body = '<script>alert(1)</script> and https://example.com'
    expect(flatten(body)).toContain('<script>alert(1)</script>')
    expect(links(body)).toHaveLength(1)
  })

  it('does not linkify a scheme-like string that is not a URL', () => {
    expect(links('ftp://example.com')).toHaveLength(0)
    expect(links('mailto:someone@example.com')).toHaveLength(0)
  })
})

describe('tokenizeLinks — display', () => {
  it('shortens a very long URL for display but keeps the href whole', () => {
    const long = `https://example.com/${'a'.repeat(200)}`
    const [link] = links(`see ${long}`)
    expect(link.label.length).toBeLessThanOrEqual(60)
    expect(link.label.endsWith('…')).toBe(true)
    expect(link.href).toContain('a'.repeat(200))
  })

  it('leaves a short URL untruncated', () => {
    expect(links('https://example.com/page')[0].label).toBe('https://example.com/page')
  })

  // Nothing may be lost or duplicated: what renders must equal what was written,
  // modulo the display truncation covered above.
  it('reproduces the original text across tokens', () => {
    const body = 'Start https://a.com middle www.b.com end.'
    expect(flatten(body)).toBe(body)
  })
})
