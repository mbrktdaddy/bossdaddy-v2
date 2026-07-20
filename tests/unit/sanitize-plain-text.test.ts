import { describe, it, expect } from 'vitest'
import { sanitizePlainText } from '@/lib/sanitize'

// A4 defense-in-depth: DM bodies + captions are plain text rendered escaped by
// React, so sanitizePlainText strips HTML markup on write WITHOUT leaving the
// survivors HTML-encoded (which would render as visible "&lt;" once React
// re-escapes the value).
describe('sanitizePlainText', () => {
  it('strips tags but keeps their inner text', () => {
    expect(sanitizePlainText('<b>hey</b> there')).toBe('hey there')
  })

  it('removes <script> and its content entirely', () => {
    expect(sanitizePlainText('hi<script>alert(1)</script>')).toBe('hi')
  })

  it('drops an onerror image payload', () => {
    expect(sanitizePlainText('<img src=x onerror=alert(1)>caption')).toBe('caption')
  })

  it('preserves plain text with stray angle brackets (no double-escape)', () => {
    expect(sanitizePlainText('5 < 10 and 20 > 3')).toBe('5 < 10 and 20 > 3')
  })

  it('preserves ampersands and quotes verbatim', () => {
    expect(sanitizePlainText(`R&D said "ship it" — it's fine`)).toBe(`R&D said "ship it" — it's fine`)
  })

  it('decodes a nested entity correctly (&amp; decoded last, not first)', () => {
    // User typed the 8 literal chars "&amp;lt;" → sanitize-html re-encodes the
    // lone ampersand to "&amp;lt;"; decoding &amp; LAST yields "&lt;", whereas
    // decoding it first would wrongly collapse to "<".
    expect(sanitizePlainText('&amp;lt;')).toBe('&lt;')
  })

  it('leaves ordinary text untouched', () => {
    expect(sanitizePlainText('just a normal message')).toBe('just a normal message')
  })

  it('returns empty string when input is only markup', () => {
    expect(sanitizePlainText('<div></div>')).toBe('')
  })
})
