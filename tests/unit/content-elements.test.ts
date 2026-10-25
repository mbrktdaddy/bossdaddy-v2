import { describe, it, expect } from 'vitest'
import { extractSteps, hasEmptyElements, normalizeElement, stripEmptyElements, type ContentElement } from '@/lib/content/elements'
import { assembleDraftHtml, elementToHtml, htmlToStructuredText } from '@/lib/content/html'
import { sanitizeHtml } from '@/lib/sanitize'
import { preserveBlocksAcrossRefine } from '@/lib/content/markers'
import { extractPreservedBlocks } from '@/lib/content/sections'
import { normalizeElementPlans } from '@/lib/content/pipeline/outline'
import { blocksOutput, elementsInstruction } from '@/lib/content/pipeline/blocks'
import type { Brief, OutlinePart } from '@/lib/content/pipeline/types'

// Lane 2 (docs/rich-elements-plan.md §3): typed body elements — recommended at
// the outline, drafted from finished prose, serialised as marker divs.

const callout: ContentElement = { type: 'callout', afterHeading: 'Fitting it', kind: 'warning', title: 'Watch out', body: 'Check the **strap** before every drive.' }
const steps: ContentElement = { type: 'steps', afterHeading: '', title: 'Steps at a glance', time: '20 minutes', items: [
  { title: 'Loosen the straps.', body: 'All four, fully.' },
  { title: 'Seat the base', body: 'Push down hard with a knee.' },
  { title: 'Tighten', body: '' },
] }

describe('elementToHtml', () => {
  it('serialises a callout as the marker div with kind + title, body as light Markdown', () => {
    expect(elementToHtml(callout)).toBe('<div class="bd-callout" data-kind="warning" data-title="Watch out">\n<p>Check the <strong>strap</strong> before every drive.</p>\n</div>')
  })
  it('serialises steps as a titled ordered list with bold lead-ins and the time attribute', () => {
    expect(elementToHtml(steps)).toBe(
      '<div class="bd-steps" data-title="Steps at a glance" data-time="20 minutes">\n<ol>\n<li><strong>Loosen the straps.</strong> All four, fully.</li>\n<li><strong>Seat the base.</strong> Push down hard with a knee.</li>\n<li><strong>Tighten.</strong></li>\n</ol>\n</div>',
    )
  })
  it('does not add a period after a step title that already ends in ? or !', () => {
    const html = elementToHtml({ ...steps, items: [{ title: 'Ready?', body: 'Go.' }, { title: 'Pull!', body: '' }] } as ContentElement)
    expect(html).toContain('<li><strong>Ready?</strong> Go.</li>')
    expect(html).toContain('<li><strong>Pull!</strong></li>')
  })
  it('escapes attribute text', () => {
    expect(elementToHtml({ ...callout, title: 'Say "no" <now>' })).toContain('data-title="Say &quot;no&quot; &lt;now&gt;"')
  })
})

const facts: ContentElement = { type: 'facts', afterHeading: '', title: 'Key facts', items: [
  { label: 'Price paid:', value: '$189' },
  { label: 'Tested for', value: 'four months' },
] }
const timeline: ContentElement = { type: 'timeline', afterHeading: 'Fitting it', title: 'How it went', items: [
  { when: 'Day 1', title: 'Install.', body: 'Twenty minutes, one knee.' },
  { when: 'Week 3', title: 'Straps loosened', body: '' },
] }

describe('elementToHtml — facts + timeline', () => {
  it('serialises facts as "label: value" rows and a timeline as "when" + moment', () => {
    expect(elementToHtml(facts)).toBe('<div class="bd-facts" data-title="Key facts">\n<ul>\n<li><strong>Price paid:</strong> $189</li>\n<li><strong>Tested for:</strong> four months</li>\n</ul>\n</div>')
    expect(elementToHtml(timeline)).toBe('<div class="bd-timeline" data-title="How it went">\n<ol>\n<li><strong>Day 1</strong> Install. Twenty minutes, one knee.</li>\n<li><strong>Week 3</strong> Straps loosened.</li>\n</ol>\n</div>')
  })
  it('passes the sanitizer, is a preserved block, and is not a steps box', () => {
    const html = elementToHtml(facts) + elementToHtml(timeline)
    const clean = sanitizeHtml(html)
    expect(clean).toContain('<div class="bd-facts" data-title="Key facts">')
    expect(clean).toContain('<div class="bd-timeline" data-title="How it went">')
    expect(extractPreservedBlocks(html).blocks).toHaveLength(2)
    expect(extractSteps(html)).toEqual([])
    expect(hasEmptyElements('<div class="bd-facts" data-title="x"><ul><li></li></ul></div>')).toBe(true)
  })
  it('normalizes model drafts: facts need two complete pairs, a timeline two dated moments', () => {
    expect(normalizeElement({ type: 'facts', afterHeading: '', title: '', facts: [{ label: 'A', value: '1' }, { label: 'B', value: ' ' }] })).toBeNull()
    expect(normalizeElement({ type: 'facts', afterHeading: '', title: '', facts: [{ label: 'A', value: '1' }, { label: 'B', value: '2' }] }))
      .toEqual({ type: 'facts', afterHeading: '', title: 'Key facts', items: [{ label: 'A', value: '1' }, { label: 'B', value: '2' }] })
    expect(normalizeElement({ type: 'timeline', afterHeading: 'A', title: 'T', events: [{ when: 'Day 1', title: 'x', body: '' }] })).toBeNull()
    expect(normalizeElement({ type: 'timeline', afterHeading: 'A', title: '', events: [{ when: 'Day 1', title: 'x', body: 'b' }, { when: '', title: 'skipped', body: '' }, { when: 'Week 2', title: 'y', body: '' }] }))
      .toEqual({ type: 'timeline', afterHeading: 'A', title: 'How it went', items: [{ when: 'Day 1', title: 'x', body: 'b' }, { when: 'Week 2', title: 'y', body: '' }] })
  })
  it('the outline keeps one facts and one timeline box per piece', () => {
    const guide: Brief = { contentType: 'guide', topic: 'T', category: 'garage', pieceType: 'howto', keyPoints: [], productSlugs: [], imageSlots: 0, inquiryMode: false }
    const parts: OutlinePart[] = [
      { kind: 'intro', heading: '', intent: 'i', notes: [], targetWords: 60, productToken: null },
      { kind: 'body', heading: 'A', intent: 'b', notes: [], targetWords: 200, productToken: null },
      { kind: 'closing', heading: 'Wrapping Up', intent: 'c', notes: [], targetWords: 80, productToken: null },
    ]
    const out = normalizeElementPlans([
      { type: 'facts', afterHeading: '', reason: '1' }, { type: 'facts', afterHeading: 'A', reason: 'dup' },
      { type: 'timeline', afterHeading: 'A', reason: '2' }, { type: 'callout', afterHeading: 'A', reason: '3' }, { type: 'callout', afterHeading: 'A', reason: '4' },
    ], parts, guide)
    // Duplicate facts dropped; the piece-wide cap of three cuts the second callout.
    expect(out.map((p) => p.type)).toEqual(['facts', 'timeline', 'callout'])
    expect(elementsInstruction(out)).toMatch(/1\. FACTS after the introduction/)
    expect(elementsInstruction(out)).toMatch(/2\. TIMELINE after "A"/)
  })
})

describe('assembleDraftHtml places elements', () => {
  it('after the intro for "" and after the matching section prose, before image slots', () => {
    const html = assembleDraftHtml({
      introduction: 'Intro.',
      sections: [{ heading: 'Fitting it', body: 'Body.' }],
      closing: { heading: 'Wrapping Up', body: 'Done.' },
      inlineImages: [{ afterHeading: 'Fitting it', prompt: 'p', altText: 'a', caption: 'c' }],
      elements: [callout, steps],
    })
    const iIntro = html.indexOf('<p>Intro.</p>'), iSteps = html.indexOf('bd-steps'), iH2 = html.indexOf('<h2>Fitting it</h2>')
    const iBody = html.indexOf('<p>Body.</p>'), iCallout = html.indexOf('bd-callout'), iFig = html.indexOf('<figure')
    expect([iIntro, iSteps, iH2, iBody, iCallout, iFig].every((n) => n >= 0)).toBe(true)
    expect(iIntro < iSteps && iSteps < iH2 && iH2 < iBody && iBody < iCallout && iCallout < iFig).toBe(true)
  })
})

describe('sanitizeHtml keeps the element markup', () => {
  it('keeps bd-callout / bd-steps with their data attributes and strips an unknown class', () => {
    const out = sanitizeHtml(elementToHtml(callout) + elementToHtml(steps) + '<div class="bd-evil" data-kind="x"><p>t</p></div>')
    expect(out).toContain('<div class="bd-callout" data-kind="warning" data-title="Watch out">')
    expect(out).toContain('<div class="bd-steps" data-title="Steps at a glance" data-time="20 minutes">')
    expect(out).not.toContain('bd-evil')
  })
})

describe('extractSteps / empty elements', () => {
  it('reads the first steps box back as HowTo facts, dropping the lead-in period', () => {
    const [box] = extractSteps(sanitizeHtml(elementToHtml(steps)))
    expect(box.title).toBe('Steps at a glance')
    expect(box.time).toBe('20 minutes')
    expect(box.items).toEqual([
      { name: 'Loosen the straps', text: 'All four, fully.' },
      { name: 'Seat the base', text: 'Push down hard with a knee.' },
      { name: 'Tighten', text: 'Tighten' },
    ])
    expect(extractSteps('<p>none</p>')).toEqual([])
  })
  it('flags and strips an element with no readable text', () => {
    const empty = '<div class="bd-callout" data-kind="tip" data-title="Tip"><p></p></div>'
    expect(hasEmptyElements(empty)).toBe(true)
    expect(hasEmptyElements(elementToHtml(callout))).toBe(false)
    expect(stripEmptyElements(`<p>a</p>${empty}<p>b</p>`)).toBe('<p>a</p><p>b</p>')
  })
})

describe('elements survive editing', () => {
  it('are preserved blocks: dropped from the refine text and re-attached under their H2', () => {
    const html = `<h2>Fitting it</h2>\n<p>Body.</p>\n${elementToHtml(callout)}`
    expect(htmlToStructuredText(html)).toBe('## Fitting it\n\nBody.')
    expect(extractPreservedBlocks(html).blocks).toEqual([elementToHtml(callout)])
    const { content, preservedCount } = preserveBlocksAcrossRefine(html, '<h2>Fitting it</h2>\n<p>New body.</p>')
    expect(preservedCount).toBe(1)
    // Whole-document refines re-attach every preserved block directly under its
    // H2 (figures too); the patch refine (replaceSectionProse) keeps it at the end.
    expect(content.indexOf('<h2>Fitting it</h2>')).toBeLessThan(content.indexOf('bd-callout'))
    expect(content).toContain('New body.')
  })
})

describe('normalizeElement (model draft → element)', () => {
  it('a callout needs a body; kind falls back to note and title to the kind label', () => {
    expect(normalizeElement({ type: 'callout', afterHeading: '', title: '', body: 'Text.' })).toEqual({ type: 'callout', afterHeading: '', kind: 'note', title: 'Note', body: 'Text.' })
    expect(normalizeElement({ type: 'callout', afterHeading: '', title: 'x', body: '  ' })).toBeNull()
  })
  it('steps need at least two titled items', () => {
    expect(normalizeElement({ type: 'steps', afterHeading: 'A', title: '', items: [{ title: 'One', body: '' }] })).toBeNull()
    const el = normalizeElement({ type: 'steps', afterHeading: 'A', title: '', time: null, items: [{ title: 'One', body: 'b' }, { title: ' Two ', body: '' }, { title: '', body: 'orphan' }] })
    expect(el).toEqual({ type: 'steps', afterHeading: 'A', title: 'Steps at a glance', time: null, items: [{ title: 'One', body: 'b' }, { title: 'Two', body: '' }] })
  })
})

describe('normalizeElementPlans (outline recommendation)', () => {
  const guide: Brief = { contentType: 'guide', topic: 'T', category: 'garage', pieceType: 'howto', keyPoints: [], productSlugs: [], imageSlots: 0, inquiryMode: false }
  const parts: OutlinePart[] = [
    { kind: 'intro', heading: '', intent: 'i', notes: [], targetWords: 60, productToken: null },
    { kind: 'body', heading: 'Fitting it', intent: 'b', notes: [], targetWords: 200, productToken: null },
    { kind: 'closing', heading: 'Wrapping Up', intent: 'c', notes: [], targetWords: 80, productToken: null },
  ]
  it('keeps plans that point at a real heading (case-insensitive) or the intro, one steps box, in part order', () => {
    const out = normalizeElementPlans([
      { type: 'callout', afterHeading: 'fitting IT', reason: 'r1' },
      { type: 'steps', afterHeading: '', reason: 'r2' },
      { type: 'steps', afterHeading: 'Fitting it', reason: 'dup' },
      { type: 'callout', afterHeading: 'Nope', reason: 'gone' },
    ], parts, guide)
    expect(out).toEqual([
      { type: 'steps', afterHeading: '', reason: 'r2' },
      { type: 'callout', afterHeading: 'Fitting it', reason: 'r1' },
    ])
  })
  it('an essay earns none', () => {
    expect(normalizeElementPlans([{ type: 'callout', afterHeading: '', reason: 'r' }], parts, { ...guide, pieceType: 'essay' })).toEqual([])
  })
})

describe('blocks stage', () => {
  const choices = { tldr: false, keyTakeaways: false, faqs: false, bestFor: false, notFor: false, prosCons: false, subScores: false }
  it('asks for exactly the planned elements, and for none when none were planned', () => {
    const plans = [{ type: 'callout' as const, afterHeading: 'Fitting it', reason: 'Strap warning' }]
    const withEls = blocksOutput(choices, 'guide', plans).safeParse({ suggestedTags: [], elements: [{ type: 'callout', afterHeading: 'Fitting it', title: 'Watch out', body: 'b' }] })
    expect(withEls.success).toBe(true)
    // Fewer is allowed (the prose may give an element nothing to say); more is not.
    expect(blocksOutput(choices, 'guide', plans).safeParse({ suggestedTags: [], elements: [] }).success).toBe(true)
    const two = [{ type: 'callout', afterHeading: 'Fitting it', title: 't', body: 'b' }, { type: 'callout', afterHeading: '', title: 't', body: 'b' }]
    expect(blocksOutput(choices, 'guide', plans).safeParse({ suggestedTags: [], elements: two }).success).toBe(false)
    expect(blocksOutput(choices, 'guide').safeParse({ suggestedTags: [] }).success).toBe(true)
    expect(elementsInstruction(plans)).toMatch(/1\. CALLOUT after "Fitting it" — Strap warning/)
    expect(elementsInstruction([])).toBe('')
  })
})
