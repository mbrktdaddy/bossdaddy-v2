import { describe, it, expect } from 'vitest'
import { splitContentForInlineCards, extractFigureSrcs, parseFigure } from '@/lib/inline-content'
import { buildFilledFigure, buildGalleryWrapper, buildPlaceholderFigure } from '@/lib/inlineImages'
import { stripAuthoringAttrs } from '@/lib/content/html'

// The segment splitter is what lets a body figure become a React <BodyFigure>
// (next/image, credit line) instead of raw HTML. Pins: a standalone filled
// figure becomes a `figure` segment carrying src/alt/caption/size/origin; a
// placeholder and a gallery's children do NOT (galleries stay HTML for the
// CSS scroll strip); prose on either side survives byte-for-byte.

const URL = 'https://x.supabase.co/storage/v1/object/public/media/a.webp'

describe('splitContentForInlineCards — figures', () => {
  it('lifts a standalone filled figure into a figure segment and keeps the prose around it', () => {
    const fig = buildFilledFigure({ slotId: 'slot-1', imageUrl: URL, alt: 'Alt "q"', caption: 'Cap & co', prompt: 'p', width: 1536, height: 1024, origin: 'ai' })
    const html = stripAuthoringAttrs(`<p>Before</p>\n${fig}\n<p>After</p>`)
    const segs = splitContentForInlineCards(html, [])
    expect(segs.map((s) => s.type)).toEqual(['html', 'figure', 'html'])
    expect(segs[0]).toEqual({ type: 'html', content: '<p>Before</p>\n' })
    expect(segs[2]).toEqual({ type: 'html', content: '\n<p>After</p>' })
    expect(segs[1]).toEqual({
      type: 'figure',
      slotId: 'slot-1',
      src: URL,
      alt: 'Alt "q"',
      caption: 'Cap & co',
      width: 1536,
      height: 1024,
      origin: 'ai',
    })
  })

  it('reports null size/origin for a legacy figure (pre-mig-166 markup)', () => {
    const legacy = `<figure class="bd-image-filled" data-slot-id="old"><img src="${URL}" alt="a" /><figcaption>c</figcaption></figure>`
    const [seg] = splitContentForInlineCards(legacy, [])
    expect(seg).toMatchObject({ type: 'figure', width: null, height: null, origin: null, caption: 'c' })
  })

  it('leaves placeholders and gallery children as HTML', () => {
    const placeholder = buildPlaceholderFigure({ slotId: 'slot-p', prompt: 'p' })
    const gallery = buildGalleryWrapper(
      [buildFilledFigure({ slotId: 'g1', imageUrl: URL, alt: 'g1' }), buildFilledFigure({ slotId: 'g2', imageUrl: URL, alt: 'g2' })],
      'gallery-1',
    )
    const segs = splitContentForInlineCards(`<p>a</p>${placeholder}${gallery}<p>b</p>`, [])
    expect(segs.every((s) => s.type === 'html')).toBe(true)
    expect(segs.map((s) => (s.type === 'html' ? s.content : '')).join('')).toContain('class="bd-image-grid"')
  })

  it('a filled figure AFTER a gallery is still lifted', () => {
    const gallery = buildGalleryWrapper([buildFilledFigure({ slotId: 'g1', imageUrl: URL, alt: 'g1' })], 'gallery-1')
    const solo = buildFilledFigure({ slotId: 's1', imageUrl: URL, alt: 'solo' })
    const segs = splitContentForInlineCards(`${gallery}<p>x</p>${solo}`, [])
    expect(segs.map((s) => s.type)).toEqual(['html', 'figure'])
  })

  it('interleaves figures with product cards in document order', () => {
    const product = { slug: 'p1', name: 'P', affiliate_url: null, non_affiliate_url: null, store: 'amazon', custom_store_name: null, image_url: null }
    const fig = buildFilledFigure({ slotId: 's1', imageUrl: URL, alt: 'a' })
    const html = `<p>a</p><p><a href="/x" data-product-slug="p1">P</a></p><p>b</p>${fig}<p>c</p>`
    const segs = splitContentForInlineCards(html, [product])
    expect(segs.map((s) => s.type)).toEqual(['html', 'product', 'html', 'figure', 'html'])
  })
})

describe('helpers', () => {
  it('extractFigureSrcs lists every filled figure url once, decoded', () => {
    const a = buildFilledFigure({ slotId: 'a', imageUrl: URL + '?x=1&y=2', alt: 'a' })
    const b = buildFilledFigure({ slotId: 'b', imageUrl: URL, alt: 'b' })
    const g = buildGalleryWrapper([buildFilledFigure({ slotId: 'c', imageUrl: URL, alt: 'c' })])
    expect(extractFigureSrcs(a + b + g)).toEqual([URL + '?x=1&y=2', URL])
  })

  it('parseFigure returns null without an <img src>', () => {
    expect(parseFigure('<figure class="bd-image-filled" data-slot-id="s"><figcaption>c</figcaption></figure>')).toBeNull()
  })
})
