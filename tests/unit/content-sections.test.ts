import { describe, it, expect } from 'vitest'
import { anchorsToTokens, countTokens, extractPreservedBlocks, replaceSectionProse, sectionToStructuredText, splitSections } from '@/lib/content/sections'
import { preserveBlocksAcrossRefine } from '@/lib/content/markers'

const FIG = '<figure class="bd-image-filled" data-slot-id="slot-1"><img src="a.webp" alt="a" /></figure>'
const EMBED = '<div class="bd-collection-embed" data-collection-slug="garage-kit"></div>'
const LINK = '<a href="/go/battery-daddy" rel="sponsored nofollow noopener" target="_blank" data-product-slug="battery-daddy">Battery Daddy on Amazon</a>'
const HTML = `<p>Intro para.</p>

<h2 class="x">Build quality</h2>
<p>Solid. Get it: ${LINK}</p>
${FIG}

<h2>Value</h2>
<p>Fair.</p>
${EMBED}

<h2>The Verdict</h2>
<p>Buy it.</p>`

describe('splitSections', () => {
  it('yields intro + one section per h2, with the heading tag verbatim', () => {
    const s = splitSections(HTML)
    expect(s.map((x) => x.heading)).toEqual([null, 'Build quality', 'Value', 'The Verdict'])
    expect(s[1].headingTag).toBe('<h2 class="x">Build quality</h2>')
    expect(s[0].html).toBe('<p>Intro para.</p>\n\n')
    expect(s[3].html).toBe('<h2>The Verdict</h2>\n<p>Buy it.</p>')
  })
  it('skips an empty intro', () => {
    expect(splitSections('<h2>A</h2><p>x</p>')[0].heading).toBe('A')
  })
})

describe('anchorsToTokens / sectionToStructuredText', () => {
  it('turns a resolved anchor back into its token and drops blocks', () => {
    const s = splitSections(HTML)[1]
    expect(anchorsToTokens(s.html)).toContain('[[BUY:battery-daddy]]')
    expect(sectionToStructuredText(s)).toBe('Solid. Get it: [[BUY:battery-daddy]]')
    expect(countTokens(sectionToStructuredText(s))).toEqual({ 'battery-daddy': 1 })
  })
})

describe('replaceSectionProse', () => {
  it('replaces only that section, keeps the heading tag and carries its blocks', () => {
    const out = replaceSectionProse(HTML, 1, 'Rebuilt.\n\nStill solid. [[BUY:battery-daddy]]')
    expect(out).toContain('<p>Intro para.</p>')
    expect(out).toContain('<h2 class="x">Build quality</h2>\n<p>Rebuilt.</p>\n<p>Still solid. [[BUY:battery-daddy]]</p>\n' + FIG)
    expect(out).not.toContain('Solid. Get it')
    expect(out).toContain('<h2>Value</h2>\n<p>Fair.</p>')
    expect(out).toContain(EMBED)
    expect(out).toContain('<h2>The Verdict</h2>\n<p>Buy it.</p>')
  })
  it('can replace the intro', () => {
    const out = replaceSectionProse(HTML, 0, 'New intro.')
    expect(out.startsWith('<p>New intro.</p>')).toBe(true)
    expect(out).toContain('<h2 class="x">Build quality</h2>')
  })
  it('a bad index is a no-op', () => {
    expect(replaceSectionProse(HTML, 9, 'x')).toBe(HTML)
  })
})

describe('extractPreservedBlocks', () => {
  it('pulls galleries as one block, not their inner figures twice', () => {
    const gallery = `<div class="bd-image-grid" data-slot-id="g1">\n${FIG}\n${FIG.replace('slot-1', 'slot-2')}\n</div>`
    const { prose, blocks } = extractPreservedBlocks(`<p>a</p>${gallery}<p>b</p>`)
    expect(blocks).toEqual([gallery])
    expect(prose).toBe('<p>a</p><p>b</p>')
  })
})

describe('preserveBlocksAcrossRefine', () => {
  it('re-attaches figures AND embeds after their headings in the rewritten piece', () => {
    const rewritten = '<p>New intro.</p>\n\n<h2>Build quality</h2>\n<p>New build.</p>\n\n<h2>Value</h2>\n<p>New value.</p>\n\n<h2>The Verdict</h2>\n<p>Buy.</p>'
    const { content, preservedCount, appendedCount } = preserveBlocksAcrossRefine(HTML, rewritten)
    expect(preservedCount).toBe(2)
    expect(appendedCount).toBe(0)
    expect(content.indexOf(FIG)).toBeGreaterThan(content.indexOf('<h2>Build quality</h2>'))
    expect(content.indexOf(FIG)).toBeLessThan(content.indexOf('<h2>Value</h2>'))
    expect(content.indexOf(EMBED)).toBeGreaterThan(content.indexOf('<h2>Value</h2>'))
    expect(content.indexOf(EMBED)).toBeLessThan(content.indexOf('<h2>The Verdict</h2>'))
  })
  it('appends blocks whose heading vanished rather than dropping them', () => {
    const rewritten = '<p>Intro.</p>\n\n<h2>Everything</h2>\n<p>All in one.</p>'
    const { content, appendedCount } = preserveBlocksAcrossRefine(HTML, rewritten)
    expect(appendedCount).toBe(2)
    expect(content).toContain(FIG)
    expect(content).toContain(EMBED)
  })
})
