import { describe, it, expect } from 'vitest'
import { parseYouTubeUrl, youtubeEmbedUrl, youtubePoster } from '@/lib/content/video'
import { hasUnfilledVideoSlots, normalizeElement, parseNumber, parseVideoMarker, stripUnfilledVideoSlots, videoMarker, type ContentElement } from '@/lib/content/elements'
import { assembleDraftHtml, elementToHtml } from '@/lib/content/html'
import { sanitizeHtml } from '@/lib/sanitize'
import { splitContentForInlineCards } from '@/lib/inline-content'
import { publishBlocker } from '@/lib/content/publish-gate'
import { extractPreservedBlocks } from '@/lib/content/sections'
import { blocksOutput, elementsInstruction } from '@/lib/content/pipeline/blocks'

// Lane 3 (docs/rich-elements-plan.md §4): video slots + bar charts.

describe('parseYouTubeUrl', () => {
  it('accepts every common URL shape and a bare ID, rejects the rest', () => {
    for (const u of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'dQw4w9WgXcQ',
    ]) expect(parseYouTubeUrl(u)).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeUrl('https://vimeo.com/12345')).toBeNull()
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(parseYouTubeUrl('not a url')).toBeNull()
  })
  it('poster and embed URLs use the image CDN and the privacy domain', () => {
    expect(youtubePoster('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/)
  })
})

describe('video slots', () => {
  const empty = videoMarker({ id: '', caption: '', subject: 'Fitting the straps' })
  const filled = videoMarker({ id: 'dQw4w9WgXcQ', caption: 'Thirty seconds on the straps', subject: 'Fitting the straps' })

  it('serialises a marker with no iframe, survives the sanitizer, and parses back', () => {
    expect(filled).toBe('<div class="bd-video" data-provider="youtube" data-id="dQw4w9WgXcQ" data-caption="Thirty seconds on the straps" data-subject="Fitting the straps"></div>')
    expect(sanitizeHtml(filled)).toBe(filled)
    expect(parseVideoMarker(filled)).toEqual({ id: 'dQw4w9WgXcQ', caption: 'Thirty seconds on the straps', subject: 'Fitting the straps' })
    expect(sanitizeHtml('<iframe src="https://evil.example"></iframe>')).toBe('')
  })
  it('an empty slot blocks publish and is stripped at render; a filled one passes', () => {
    expect(hasUnfilledVideoSlots(empty)).toBe(true)
    expect(hasUnfilledVideoSlots(filled)).toBe(false)
    expect(stripUnfilledVideoSlots(`<p>a</p>${empty}<p>b</p>${filled}`)).toBe(`<p>a</p><p>b</p>${filled}`)
    expect(publishBlocker(`<p>a</p>${empty}`)).toMatch(/empty video slot/)
    expect(publishBlocker(`<p>a</p>${filled}`)).toBeNull()
  })
  it('a planned slot lands after its part as an empty marker, and is a preserved block', () => {
    const html = assembleDraftHtml({ introduction: 'Intro.', sections: [{ heading: 'Fitting it', body: 'Body.' }], videoSlots: [{ afterHeading: 'Fitting it', subject: 'Fitting the straps' }] })
    expect(html).toContain('<p>Body.</p>\n<div class="bd-video" data-provider="youtube" data-id="" data-caption="" data-subject="Fitting the straps"></div>')
    expect(extractPreservedBlocks(html).blocks).toHaveLength(1)
  })
  it('renders as a video segment only when filled; attribute order does not matter', () => {
    const tiptapOrder = '<div data-provider="youtube" data-id="dQw4w9WgXcQ" data-caption="c" data-subject="" class="bd-video"></div>'
    const segs = splitContentForInlineCards(`<p>a</p>${tiptapOrder}<p>b</p>`, [])
    expect(segs.map((s) => s.type)).toEqual(['html', 'video', 'html'])
    expect(segs[1]).toEqual({ type: 'video', id: 'dQw4w9WgXcQ', caption: 'c' })
    expect(splitContentForInlineCards(`<p>a</p>${empty}`, []).map((s) => s.type)).toEqual(['html'])
  })
  it('the blocks stage never drafts a video slot', () => {
    const plans = [{ type: 'video' as const, afterHeading: '', reason: 'Strap demo' }, { type: 'callout' as const, afterHeading: '', reason: 'r' }]
    expect(elementsInstruction(plans)).toMatch(/^ELEMENTS[\s\S]*1\. CALLOUT/)
    expect(elementsInstruction(plans)).not.toMatch(/VIDEO/)
    const choices = { tldr: false, keyTakeaways: false, faqs: false, bestFor: false, notFor: false, prosCons: false, subScores: false }
    // Only a video plan → no `elements` field in the schema, so any drafted elements are dropped on parse.
    const parsed = blocksOutput(choices, 'guide', [plans[0]]).safeParse({ suggestedTags: [], elements: [{ type: 'callout', afterHeading: '', title: 't', body: 'b' }] })
    expect(parsed.success).toBe(true)
    expect(parsed.success && (parsed.data as { elements?: unknown }).elements).toBeUndefined()
  })
})

describe('charts', () => {
  const chart: ContentElement = { type: 'chart', afterHeading: '', title: 'Weight', unit: 'lb', items: [
    { label: 'This seat', value: 9.5 }, { label: 'Old seat', value: 12 }, { label: 'Rival', value: 11.2 },
  ] }

  it('parseNumber reads numbers out of prose values', () => {
    expect(parseNumber('$189')).toBe(189)
    expect(parseNumber('1,200 miles')).toBe(1200)
    expect(parseNumber('about 4.5 lb')).toBe(4.5)
    expect(parseNumber('none')).toBeNull()
  })
  it('a chart draft needs three numeric rows', () => {
    expect(normalizeElement({ type: 'chart', afterHeading: '', title: '', unit: 'lb', facts: [{ label: 'A', value: '1' }, { label: 'B', value: 'n/a' }, { label: 'C', value: '3' }] })).toBeNull()
    expect(normalizeElement({ type: 'chart', afterHeading: '', title: '', unit: ' lb ', facts: [{ label: 'A', value: '1 lb' }, { label: 'B', value: '2' }, { label: 'C', value: '3.5' }] }))
      .toEqual({ type: 'chart', afterHeading: '', title: 'By the numbers', unit: 'lb', items: [{ label: 'A', value: 1 }, { label: 'B', value: 2 }, { label: 'C', value: 3.5 }] })
  })
  it('serialises as a facts-shaped list the sanitizer keeps, and becomes a chart segment with parsed rows', () => {
    const html = elementToHtml(chart)
    expect(html).toBe('<div class="bd-chart" data-title="Weight" data-unit="lb">\n<ul>\n<li><strong>This seat:</strong> 9.5</li>\n<li><strong>Old seat:</strong> 12</li>\n<li><strong>Rival:</strong> 11.2</li>\n</ul>\n</div>')
    expect(sanitizeHtml(html)).toBe(html)
    const segs = splitContentForInlineCards(`<p>a</p>${html}`, [])
    expect(segs[1]).toMatchObject({ type: 'chart', title: 'Weight', unit: 'lb', rows: [{ label: 'This seat', value: 9.5 }, { label: 'Old seat', value: 12 }, { label: 'Rival', value: 11.2 }] })
    expect((segs[1] as { listHtml: string }).listHtml).toMatch(/^<ul>[\s\S]*<\/ul>$/)
  })
  it('a box whose rows are not all numbers stays HTML (reads as a facts list)', () => {
    const html = '<div class="bd-chart" data-title="Mixed"><ul><li><strong>A:</strong> 1</li><li><strong>B:</strong> lots</li><li><strong>C:</strong> 3</li></ul></div>'
    expect(splitContentForInlineCards(html, []).map((s) => s.type)).toEqual(['html'])
  })
})
