import { describe, it, expect } from 'vitest'
import { hasUnfilledImageSlots, stripPlaceholderFigures, UNFILLED_SLOTS_MESSAGE } from '@/lib/content/publish-gate'
import { buildFilledFigure, buildPlaceholderFigure } from '@/lib/inlineImages'

// Submit + approve refuse a body with an empty image slot (it would render as
// a dashed "Image slot" box publicly); the renderer strips one that slipped by.

const URL = 'https://x.supabase.co/storage/v1/object/public/media/a.webp'

describe('hasUnfilledImageSlots', () => {
  it('is true only when a placeholder figure is present', () => {
    expect(hasUnfilledImageSlots(null)).toBe(false)
    expect(hasUnfilledImageSlots('')).toBe(false)
    expect(hasUnfilledImageSlots('<p>x</p>' + buildFilledFigure({ imageUrl: URL, alt: 'a' }))).toBe(false)
    expect(hasUnfilledImageSlots('<p>x</p>' + buildPlaceholderFigure({ prompt: 'p' }))).toBe(true)
  })

  it('ignores the class name appearing in prose', () => {
    expect(hasUnfilledImageSlots('<p>the bd-image-placeholder class</p>')).toBe(false)
  })

  it('has a message that tells the author where to fix it', () => {
    expect(UNFILLED_SLOTS_MESSAGE).toMatch(/Inline images panel/)
  })
})

describe('stripPlaceholderFigures', () => {
  it('removes every placeholder and keeps filled figures + prose', () => {
    const filled = buildFilledFigure({ slotId: 'f', imageUrl: URL, alt: 'a' })
    const html = `<p>a</p>${buildPlaceholderFigure({ slotId: 'p1' })}<p>b</p>${filled}${buildPlaceholderFigure({ slotId: 'p2' })}`
    expect(stripPlaceholderFigures(html)).toBe(`<p>a</p><p>b</p>${filled}`)
  })
})
