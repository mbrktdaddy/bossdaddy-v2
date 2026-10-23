import { describe, it, expect } from 'vitest'
import {
  buildFilledFigure,
  buildPlaceholderFigure,
  extractSlots,
  extractItems,
  fillSlot,
  revertSlot,
  removeSlot,
  updateSlotMeta,
  promoteUntaggedFigures,
  moveSlotToPosition,
  insertAtPosition,
  buildGalleryWrapper,
} from '@/lib/inlineImages'

// lib/inlineImages.ts is the string-level editor every inline image goes
// through (the panel, the pipeline's placeholders, refines). It had no tests
// before Phase 3 changed its builders; these pin the existing behaviour first,
// then the new facts (width/height on the <img>, data-origin on the <figure>).

const URL = 'https://x.supabase.co/storage/v1/object/public/media/a.webp'

describe('builders', () => {
  it('builds a placeholder with the authoring attrs and a caption fallback chain', () => {
    // The figcaption falls back caption → alt → prompt → "Image slot", but only
    // for ABSENT values: an explicit empty caption stays empty.
    const html = buildPlaceholderFigure({ slotId: 'slot-1', prompt: 'p', alt: 'a', caption: '' })
    expect(html).toBe('<figure class="bd-image-placeholder" data-slot-id="slot-1" data-prompt="p" data-alt="a" data-caption=""><figcaption></figcaption></figure>')
    expect(buildPlaceholderFigure({ slotId: 's', prompt: 'p', alt: 'a' })).toContain('<figcaption>a</figcaption>')
    expect(buildPlaceholderFigure({ slotId: 's', prompt: 'p' })).toContain('<figcaption>p</figcaption>')
    expect(buildPlaceholderFigure({ slotId: 's' })).toContain('<figcaption>Image slot</figcaption>')
  })

  it('builds a filled figure without dimensions/origin when none are known', () => {
    const html = buildFilledFigure({ slotId: 'slot-1', imageUrl: URL, alt: 'Alt "q"', caption: 'Cap' })
    expect(html).toBe(`<figure class="bd-image-filled" data-slot-id="slot-1" data-prompt="" data-alt="Alt &quot;q&quot;" data-caption="Cap"><img src="${URL}" alt="Alt &quot;q&quot;" /><figcaption>Cap</figcaption></figure>`)
  })

  it('writes width/height on the img and data-origin on the figure when known', () => {
    const html = buildFilledFigure({ slotId: 'slot-1', imageUrl: URL, alt: 'a', width: 1536, height: 1024, origin: 'ai' })
    expect(html).toContain('data-origin="ai">')
    expect(html).toContain(`<img src="${URL}" alt="a" width="1536" height="1024" />`)
  })

  it('omits dimensions unless BOTH are positive integers', () => {
    expect(buildFilledFigure({ imageUrl: URL, alt: 'a', width: 1536, height: null })).not.toContain('width=')
    expect(buildFilledFigure({ imageUrl: URL, alt: 'a', width: 0, height: 10 })).not.toContain('width=')
    expect(buildFilledFigure({ imageUrl: URL, alt: 'a', width: 1535.6, height: 1024 })).toContain('width="1536"')
  })

  it('escapes attribute values', () => {
    const html = buildFilledFigure({ imageUrl: URL + '?a=1&b=2', alt: '<b>', origin: 'ai"x' })
    expect(html).toContain('src="' + URL + '?a=1&amp;b=2"')
    expect(html).toContain('alt="&lt;b&gt;"')
    expect(html).toContain('data-origin="ai&quot;x"')
  })
})

describe('extractSlots', () => {
  it('reads prompt/alt/caption, filled state and url, plus the new facts', () => {
    const html =
      '<p>x</p>' +
      buildPlaceholderFigure({ slotId: 'slot-1', prompt: 'p1', alt: 'a1', caption: 'c1' }) +
      buildFilledFigure({ slotId: 'slot-2', imageUrl: URL, alt: 'a2', caption: 'c2', prompt: 'p2', width: 800, height: 600, origin: 'own' })
    const slots = extractSlots(html)
    expect(slots).toHaveLength(2)
    expect(slots[0]).toMatchObject({ slotId: 'slot-1', prompt: 'p1', alt: 'a1', caption: 'c1', filled: false })
    expect(slots[0].imageUrl).toBeUndefined()
    expect(slots[0].width).toBeUndefined()
    expect(slots[1]).toMatchObject({ slotId: 'slot-2', filled: true, imageUrl: URL, width: 800, height: 600, origin: 'own' })
    expect(slots[1].start).toBeGreaterThan(0)
    expect(html.slice(slots[1].start, slots[1].end)).toBe(slots[1].raw)
  })

  it('decodes entities in the attributes it reads back', () => {
    const html = buildFilledFigure({ slotId: 's', imageUrl: URL + '?a=1&b=2', alt: 'Alt "q"' })
    const [slot] = extractSlots(html)
    expect(slot.imageUrl).toBe(URL + '?a=1&b=2')
    expect(slot.alt).toBe('Alt "q"')
  })
})

describe('fillSlot', () => {
  const placeholder = buildPlaceholderFigure({ slotId: 'slot-1', prompt: 'p', alt: 'a', caption: 'Cap' })

  it('turns a placeholder into a filled figure, keeps the caption, uses data-alt when no alt is given', () => {
    const out = fillSlot(`<p>a</p>${placeholder}<p>b</p>`, 'slot-1', URL)
    expect(out).toContain('class="bd-image-filled"')
    expect(out).toContain(`<img src="${URL}" alt="a" />`)
    expect(out).toContain('<figcaption>Cap</figcaption>')
    expect(out.startsWith('<p>a</p>')).toBe(true)
    expect(out.endsWith('<p>b</p>')).toBe(true)
  })

  it('writes a supplied alt onto both data-alt and the img', () => {
    const out = fillSlot(placeholder, 'slot-1', URL, 'New alt')
    expect(out).toContain('data-alt="New alt"')
    expect(out).toContain('alt="New alt"')
  })

  it('writes width/height and data-origin from the meta', () => {
    const out = fillSlot(placeholder, 'slot-1', URL, undefined, { width: 1536, height: 1024, origin: 'ai' })
    expect(out).toContain('width="1536" height="1024"')
    expect(out).toMatch(/<figure[^>]*data-origin="ai"/)
  })

  it('replaces a stale origin on refill and drops it when the new image has none', () => {
    const filledAi = fillSlot(placeholder, 'slot-1', URL, undefined, { origin: 'ai' })
    const refilledOwn = fillSlot(filledAi, 'slot-1', URL, undefined, { origin: 'own' })
    expect(refilledOwn.match(/data-origin=/g)).toHaveLength(1)
    expect(refilledOwn).toContain('data-origin="own"')
    const refilledUnknown = fillSlot(refilledOwn, 'slot-1', URL)
    expect(refilledUnknown).not.toContain('data-origin=')
  })

  it('leaves other slots alone', () => {
    const other = buildPlaceholderFigure({ slotId: 'slot-2', prompt: 'q' })
    const out = fillSlot(placeholder + other, 'slot-1', URL)
    expect(out).toContain(other)
  })
})

describe('revertSlot / removeSlot', () => {
  it('revert restores a placeholder with the caption and no origin', () => {
    const filled = buildFilledFigure({ slotId: 'slot-1', imageUrl: URL, alt: 'a', caption: 'Cap', origin: 'ai' })
    const out = revertSlot(filled, 'slot-1')
    expect(out).toContain('class="bd-image-placeholder"')
    expect(out).toContain('<figcaption>Cap</figcaption>')
    expect(out).not.toContain('<img')
    expect(out).not.toContain('data-origin')
  })

  it('remove deletes the figure and collapses blank lines', () => {
    const fig = buildFilledFigure({ slotId: 'slot-1', imageUrl: URL, alt: 'a' })
    expect(removeSlot(`<p>a</p>\n\n\n${fig}\n\n\n<p>b</p>`, 'slot-1')).toBe('<p>a</p>\n\n\n\n<p>b</p>'.replace(/\n{3,}/g, '\n\n'))
  })
})

describe('updateSlotMeta', () => {
  it('updates caption (attr + figcaption), alt (attr + img) and prompt', () => {
    const filled = buildFilledFigure({ slotId: 'slot-1', imageUrl: URL, alt: 'a', caption: 'Cap' })
    let out = updateSlotMeta(filled, 'slot-1', { caption: 'New cap' })
    expect(out).toContain('data-caption="New cap"')
    expect(out).toContain('<figcaption>New cap</figcaption>')
    out = updateSlotMeta(out, 'slot-1', { alt: 'New alt' })
    expect(out).toContain('data-alt="New alt"')
    expect(out).toContain('alt="New alt"')
    out = updateSlotMeta(out, 'slot-1', { prompt: 'New prompt' })
    expect(out).toContain('data-prompt="New prompt"')
  })

  it('removes the figcaption when the caption is cleared, and adds one when it was absent', () => {
    const filled = buildFilledFigure({ slotId: 'slot-1', imageUrl: URL, alt: 'a', caption: 'Cap' })
    const cleared = updateSlotMeta(filled, 'slot-1', { caption: '' })
    expect(cleared).not.toContain('<figcaption')
    const added = updateSlotMeta(cleared, 'slot-1', { caption: 'Back' })
    expect(added).toContain('<figcaption>Back</figcaption>')
  })
})

describe('promoteUntaggedFigures', () => {
  it('gives untagged figures a slot id + class and leaves tagged ones untouched', () => {
    const tagged = buildFilledFigure({ slotId: 'slot-1', imageUrl: URL, alt: 'a' })
    const untagged = `<figure><img src="${URL}" alt="Loose" /><figcaption>Cap <em>x</em></figcaption></figure>`
    const out = promoteUntaggedFigures(tagged + untagged + '<figure><figcaption>Empty</figcaption></figure>')
    expect(out).toContain(tagged)
    expect(out).toMatch(/<figure class="bd-image-filled" data-slot-id="slot-[a-z0-9]+" data-prompt="" data-alt="Loose" data-caption="Cap x">/)
    expect(out).toMatch(/<figure class="bd-image-placeholder" data-slot-id="slot-[a-z0-9]+"/)
    expect(promoteUntaggedFigures(out)).toBe(out) // idempotent
  })
})

describe('ordering', () => {
  const f = (id: string) => buildFilledFigure({ slotId: id, imageUrl: URL, alt: id })

  it('moveSlotToPosition reorders figures and leaves prose in place', () => {
    const html = `<p>a</p>${f('s1')}<p>b</p>${f('s2')}<p>c</p>${f('s3')}`
    const out = moveSlotToPosition(html, 's3', 1)
    const ids = extractSlots(out).map((s) => s.slotId)
    expect(ids).toEqual(['s3', 's1', 's2'])
    expect(out.replace(/<figure[\s\S]*?<\/figure>/g, '')).toBe('<p>a</p><p>b</p><p>c</p>')
    expect(moveSlotToPosition(html, 's1', 1)).toBe(html)
    expect(moveSlotToPosition(html, 'nope', 2)).toBe(html)
  })

  it('insertAtPosition targets start, end and after a heading', () => {
    const html = '<h2>One</h2><p>a</p><h2>Two</h2><p>b</p>'
    expect(insertAtPosition(html, 'X', { kind: 'start' })).toBe('X\n\n' + html)
    expect(insertAtPosition(html, 'X', { kind: 'end' })).toBe(html + '\n\nX')
    expect(insertAtPosition(html, 'X', { kind: 'afterHeading', index: 1 })).toBe('<h2>One</h2><p>a</p><h2>Two</h2>\n\nX<p>b</p>')
    expect(insertAtPosition(html, 'X', { kind: 'afterHeading', index: 9 })).toBe(html + '\n\nX')
  })
})

describe('extractItems (galleries)', () => {
  it('groups figures inside a .bd-image-grid under one gallery item and keeps singles', () => {
    const single = buildFilledFigure({ slotId: 's1', imageUrl: URL, alt: 'a' })
    const gallery = buildGalleryWrapper(
      [buildFilledFigure({ slotId: 'g1', imageUrl: URL, alt: 'g1' }), buildFilledFigure({ slotId: 'g2', imageUrl: URL, alt: 'g2' })],
      'gallery-1',
    )
    const items = extractItems(`<p>a</p>${gallery}<p>b</p>${single}`)
    expect(items.map((i) => i.kind)).toEqual(['gallery', 'single'])
    const g = items[0]
    if (g.kind !== 'gallery') throw new Error('expected gallery')
    expect(g.slotId).toBe('gallery-1')
    expect(g.children.map((c) => c.slotId)).toEqual(['g1', 'g2'])
  })
})
