// Metadata extraction from a fetched page. The cases here are the ones that vary
// in the wild — attribute order, quote style, entities — because a naive matcher
// gets each of them wrong and silently returns nothing for a chunk of the web.

import { describe, it, expect } from 'vitest'
import { parseMetadata } from '@/lib/link-preview/parse'

const page = (head: string) => `<!doctype html><html><head>${head}</head><body><p>hi</p></body></html>`

describe('parseMetadata — the happy path', () => {
  it('reads Open Graph tags', () => {
    const meta = parseMetadata(page(`
      <meta property="og:title" content="The Best Stroller">
      <meta property="og:description" content="We tested nine of them.">
      <meta property="og:site_name" content="Boss Daddy">
      <meta property="og:image" content="https://cdn.example.com/hero.jpg">
    `))
    expect(meta.title).toBe('The Best Stroller')
    expect(meta.description).toBe('We tested nine of them.')
    expect(meta.siteName).toBe('Boss Daddy')
    expect(meta.imageUrl).toBe('https://cdn.example.com/hero.jpg')
  })

  it('falls back to twitter tags, then to <title>', () => {
    expect(parseMetadata(page('<meta name="twitter:title" content="From Twitter">')).title).toBe('From Twitter')
    expect(parseMetadata(page('<title>Just A Title</title>')).title).toBe('Just A Title')
    expect(parseMetadata(page('<meta name="description" content="Plain meta desc">')).description)
      .toBe('Plain meta desc')
  })

  it('prefers og over twitter over title', () => {
    const meta = parseMetadata(page(`
      <title>Third</title>
      <meta name="twitter:title" content="Second">
      <meta property="og:title" content="First">
    `))
    expect(meta.title).toBe('First')
  })

  it('returns nulls for a page with no metadata at all', () => {
    const meta = parseMetadata(page(''))
    expect(meta).toEqual({ title: null, description: null, siteName: null, imageUrl: null })
  })
})

describe('parseMetadata — the shapes that break naive matchers', () => {
  // Both orders are common, and matching only the first quietly loses the rest.
  it('handles content BEFORE the property attribute', () => {
    const meta = parseMetadata(page('<meta content="Backwards" property="og:title">'))
    expect(meta.title).toBe('Backwards')
  })

  it('handles single quotes', () => {
    expect(parseMetadata(page("<meta property='og:title' content='Single'>")).title).toBe('Single')
  })

  it('handles extra attributes and odd spacing', () => {
    const meta = parseMetadata(page('<meta   property = "og:title"   data-x="1"   content = "Spaced"  />'))
    expect(meta.title).toBe('Spaced')
  })

  it('collapses whitespace and newlines inside a value', () => {
    expect(parseMetadata(page('<meta property="og:title" content="Line one\n   line two">')).title)
      .toBe('Line one line two')
  })

  // A <meta> inside body content — a code sample on a developer blog, typically —
  // must not win over the real one in the head.
  it('ignores meta tags outside the head', () => {
    const html = `<html><head><meta property="og:title" content="Real"></head>
      <body><meta property="og:title" content="Fake"></body></html>`
    expect(parseMetadata(html).title).toBe('Real')
  })
})

describe('parseMetadata — entities', () => {
  it('decodes the common named entities', () => {
    expect(parseMetadata(page('<meta property="og:title" content="Dads &amp; Sons">')).title)
      .toBe('Dads & Sons')
    expect(parseMetadata(page('<meta property="og:title" content="&quot;Quoted&quot;">')).title)
      .toBe('"Quoted"')
  })

  it('decodes numeric and hex references', () => {
    expect(parseMetadata(page('<meta property="og:title" content="caf&#233;">')).title).toBe('café')
    expect(parseMetadata(page('<meta property="og:title" content="caf&#xe9;">')).title).toBe('café')
  })

  // &amp; is decoded LAST on purpose: doing it first would turn `&amp;lt;` into
  // `<`, unwrapping one layer of encoding into markup.
  it('does not let double-encoding unwrap into markup', () => {
    expect(parseMetadata(page('<meta property="og:title" content="&amp;lt;script&amp;gt;">')).title)
      .toBe('&lt;script&gt;')
  })

  it('survives a malformed numeric entity', () => {
    const meta = parseMetadata(page('<meta property="og:title" content="bad &#99999999999; ok">'))
    expect(meta.title).toContain('bad')
    expect(meta.title).toContain('ok')
  })
})

describe('parseMetadata — limits', () => {
  it('truncates a very long title and description', () => {
    const meta = parseMetadata(page(`
      <meta property="og:title" content="${'t'.repeat(500)}">
      <meta property="og:description" content="${'d'.repeat(900)}">
    `))
    expect(meta.title!.length).toBeLessThanOrEqual(200)
    expect(meta.description!.length).toBeLessThanOrEqual(300)
    expect(meta.title!.endsWith('…')).toBe(true)
  })

  // A URL is not display text: truncating it produces a silently unfetchable
  // address, so an over-long one becomes null instead.
  it('drops an over-long image URL rather than truncating it', () => {
    const meta = parseMetadata(page(`<meta property="og:image" content="https://e.com/${'a'.repeat(3000)}">`))
    expect(meta.imageUrl).toBeNull()
  })

  it('never ellipsizes an image URL it keeps', () => {
    const meta = parseMetadata(page(`<meta property="og:image" content="https://e.com/${'a'.repeat(300)}.jpg">`))
    expect(meta.imageUrl).not.toBeNull()
    expect(meta.imageUrl).not.toContain('…')
  })
})
