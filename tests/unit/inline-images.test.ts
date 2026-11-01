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
import { onlyOwnedSlotsUnfilled, publishBlocker, UNFILLED_OWNED_MESSAGE, UNFILLED_SLOTS_MESSAGE } from '@/lib/content/publish-gate'

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

describe('the photo editor plan on a slot (need / shot / aspect / ask)', () => {
  const plan = { need: 'owned', shot: 'detail', aspect: '4:5', ask: 'a screenshot of the sign-in screen' } as const

  it('writes the plan after the authoring attrs on a placeholder, only for what is set', () => {
    const html = buildPlaceholderFigure({ slotId: 'slot-1', prompt: '', alt: 'a', caption: 'c', ...plan })
    expect(html).toBe('<figure class="bd-image-placeholder" data-slot-id="slot-1" data-prompt="" data-alt="a" data-caption="c" data-need="owned" data-shot="detail" data-aspect="4:5" data-ask="a screenshot of the sign-in screen"><figcaption>c</figcaption></figure>')
    const some = buildPlaceholderFigure({ slotId: 's', prompt: 'p', aspect: '1:1' })
    expect(some).toContain(' data-aspect="1:1">')
    expect(some).not.toMatch(/data-(need|shot|ask)/)
  })

  it('leaves out blank asks and values outside the vocabulary', () => {
    const html = buildPlaceholderFigure({ slotId: 's', ask: '   ', need: 'banana' as never, shot: null, aspect: undefined })
    expect(html).not.toMatch(/data-(need|shot|aspect|ask)/)
  })

  it('an owned placeholder with no caption says what to take; a caption wins; other needs are unchanged', () => {
    expect(buildPlaceholderFigure({ slotId: 's', need: 'owned', ask: 'a screenshot of the app', alt: 'alt' })).toContain('<figcaption>Photo to take: a screenshot of the app</figcaption>')
    // an explicit empty caption counts as none for an owned slot (it still has to say something useful)
    expect(buildPlaceholderFigure({ slotId: 's', need: 'owned', ask: 'a screenshot of the app', caption: '' })).toContain('<figcaption>Photo to take: a screenshot of the app</figcaption>')
    expect(buildPlaceholderFigure({ slotId: 's', need: 'owned', ask: 'x', caption: 'Real caption' })).toContain('<figcaption>Real caption</figcaption>')
    expect(buildPlaceholderFigure({ slotId: 's', need: 'scene', ask: 'x', alt: 'a' })).toContain('<figcaption>a</figcaption>')
    expect(buildPlaceholderFigure({ slotId: 's', need: 'owned', alt: 'a' })).toContain('<figcaption>a</figcaption>') // no ask: the usual chain
  })

  it('escapes the ask going in and decodes it coming out', () => {
    const html = buildPlaceholderFigure({ slotId: 's', need: 'owned', ask: 'Photo of the "Quick" <menu> & more' })
    expect(html).toContain('data-ask="Photo of the &quot;Quick&quot; &lt;menu&gt; &amp; more"')
    expect(extractSlots(html)[0].ask).toBe('Photo of the "Quick" <menu> & more')
  })

  it('a filled figure carries the plan, with data-origin still last', () => {
    const html = buildFilledFigure({ slotId: 's', imageUrl: URL, alt: 'a', origin: 'ai', need: 'scene', shot: 'wide', aspect: '3:2' })
    expect(html).toContain('data-need="scene" data-shot="wide" data-aspect="3:2" data-origin="ai">')
  })

  it('extractSlots reads the plan back and ignores values outside the vocabulary', () => {
    expect(extractSlots(buildPlaceholderFigure({ slotId: 'slot-1', prompt: '', ...plan }))[0]).toMatchObject(plan)
    const junk = '<figure class="bd-image-placeholder" data-slot-id="s" data-need="banana" data-shot="drone" data-aspect="9:16" data-ask=""><figcaption>x</figcaption></figure>'
    const [slot] = extractSlots(junk)
    expect([slot.need, slot.shot, slot.aspect, slot.ask]).toEqual([undefined, undefined, undefined, undefined])
    // a figure from before the plan existed carries none of the keys at all
    const [old] = extractSlots(buildPlaceholderFigure({ slotId: 'o', prompt: 'p' }))
    expect(['need', 'shot', 'aspect', 'ask'].some((k) => k in old)).toBe(false)
  })

  it('reads the plan whatever the attribute order (the editor re-serialises figures)', () => {
    const html = '<figure data-ask="take it" data-aspect="1:1" class="bd-image-placeholder" data-need="owned" data-slot-id="s" data-shot="overhead"><figcaption>x</figcaption></figure>'
    expect(extractSlots(html)[0]).toMatchObject({ need: 'owned', shot: 'overhead', aspect: '1:1', ask: 'take it' })
  })

  it('survives the whole life of a slot: place, extract, fill, adjust, revert', () => {
    const placed = '<h2>One</h2>' + buildPlaceholderFigure({ slotId: 'slot-1', prompt: '', alt: 'The sign-in screen', caption: '', ...plan }) + '<p>after</p>'
    expect(promoteUntaggedFigures(placed)).toBe(placed) // the panel runs this on mount; a tagged figure is left alone
    expect(extractSlots(placed)[0]).toMatchObject({ ...plan, filled: false })

    // fill keeps the plan: it carries the open tag's attributes over
    const filled = fillSlot(placed, 'slot-1', URL, undefined, { origin: 'own', width: 800, height: 1000 })
    expect(extractSlots(filled)[0]).toMatchObject({ ...plan, filled: true, origin: 'own', imageUrl: URL })

    // the panel adjusts the shape and the plan through updateSlotMeta; each attribute is replaced, never duplicated
    const adjusted = updateSlotMeta(filled, 'slot-1', { aspect: '1:1', ask: 'a screenshot of the settings screen', need: 'scene' })
    expect(extractSlots(adjusted)[0]).toMatchObject({ aspect: '1:1', ask: 'a screenshot of the settings screen', need: 'scene', shot: 'detail' })
    expect(adjusted.match(/data-aspect=/g)).toHaveLength(1)
    expect(adjusted.match(/data-need=/g)).toHaveLength(1)
    expect(adjusted.match(/data-ask=/g)).toHaveLength(1)

    // revert keeps the plan, and an owned slot with no caption tells the author what to take again
    const reverted = revertSlot(updateSlotMeta(adjusted, 'slot-1', { need: 'owned' }), 'slot-1')
    expect(reverted).toContain('class="bd-image-placeholder"')
    expect(reverted).toContain('<figcaption>Photo to take: a screenshot of the settings screen</figcaption>')
    expect(extractSlots(reverted)[0]).toMatchObject({ need: 'owned', aspect: '1:1', shot: 'detail', filled: false })

    // an aspect or need outside the vocabulary is ignored, not written
    const same = updateSlotMeta(reverted, 'slot-1', { aspect: '9:16' as never, need: 'banana' as never })
    expect(same).toBe(reverted)
  })

  it('updateSlotMeta: a blank ask removes the attribute, and free text lands verbatim', () => {
    const placed = buildPlaceholderFigure({ slotId: 'slot-1', need: 'owned', ask: 'first' })
    const cleared = updateSlotMeta(placed, 'slot-1', { ask: '   ' })
    expect(cleared).not.toContain('data-ask')
    expect(extractSlots(cleared)[0].ask).toBeUndefined()

    // String.replace reads dollar sequences in a replacement string; neither the append branch
    // (no attribute yet) nor the replace branch (attribute present) of the writer may.
    const D = String.fromCharCode(36)
    const tricky = `the ${D}& total, ${D}${D}5 and ${D}1 sequences`
    const appended = updateSlotMeta(cleared, 'slot-1', { ask: tricky })
    expect(extractSlots(appended)[0].ask).toBe(tricky)
    const replaced = updateSlotMeta(appended, 'slot-1', { ask: tricky + '!' })
    expect(extractSlots(replaced)[0].ask).toBe(tricky + '!')
    expect(extractSlots(updateSlotMeta(replaced, 'slot-1', { prompt: tricky }))[0].prompt).toBe(tricky)
  })

  it('moving a slot carries its plan along', () => {
    const a = buildPlaceholderFigure({ slotId: 'a', prompt: 'p', need: 'scene', shot: 'wide', aspect: '3:2' })
    const b = buildPlaceholderFigure({ slotId: 'b', need: 'owned', ask: 'take it', aspect: '4:5' })
    const out = moveSlotToPosition(`<p>x</p>${a}<p>y</p>${b}`, 'b', 1)
    expect(extractSlots(out).map((s) => [s.slotId, s.need, s.aspect])).toEqual([['b', 'owned', '4:5'], ['a', 'scene', '3:2']])
  })
})

describe('publish gate and owned slots', () => {
  const owned = buildPlaceholderFigure({ slotId: 'a', need: 'owned', ask: 'a screenshot of the app' })
  const scene = buildPlaceholderFigure({ slotId: 'b', prompt: 'p', need: 'scene' })
  const plain = buildPlaceholderFigure({ slotId: 'c', prompt: 'p' })

  it('says it is waiting for the author when every empty slot is owned', () => {
    expect(onlyOwnedSlotsUnfilled(owned)).toBe(true)
    expect(publishBlocker('<p>x</p>' + owned)).toBe(UNFILLED_OWNED_MESSAGE)
    expect(UNFILLED_OWNED_MESSAGE).toMatch(/your own photo/)
  })

  it('says the generic thing when any empty slot is an AI one, or the plan is absent', () => {
    expect(publishBlocker(owned + scene)).toBe(UNFILLED_SLOTS_MESSAGE)
    expect(publishBlocker(owned + plain)).toBe(UNFILLED_SLOTS_MESSAGE)
    expect(publishBlocker(plain)).toBe(UNFILLED_SLOTS_MESSAGE)
    expect(onlyOwnedSlotsUnfilled(plain)).toBe(false)
    expect(onlyOwnedSlotsUnfilled(null)).toBe(false)
  })

  it('reads the need whatever the attribute order, and a filled owned slot no longer blocks', () => {
    const reordered = '<figure data-need="owned" data-slot-id="x" class="bd-image-placeholder"><figcaption>x</figcaption></figure>'
    expect(publishBlocker(reordered)).toBe(UNFILLED_OWNED_MESSAGE)
    const filled = buildFilledFigure({ slotId: 'd', imageUrl: URL, alt: 'a', need: 'owned', ask: 'a screenshot of the app' })
    expect(onlyOwnedSlotsUnfilled(filled)).toBe(false)
    expect(publishBlocker(filled)).toBeNull()
  })
})
