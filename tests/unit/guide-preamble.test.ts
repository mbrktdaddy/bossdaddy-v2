import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import QuickTakeCard from '@/components/content/QuickTakeCard'
import { blocksOutput } from '@/lib/content/pipeline/blocks'
import type { BlockChoices } from '@/lib/content/pipeline/types'

// The guide preamble (2026-11-13): one summary card instead of two stacked
// boxes, and the summary asked for at a glance's length. Server renders, like
// the other component tests here (node environment, no DOM). The collapsible
// table of contents scans the DOM after mount, so it is covered by the phone
// walkthrough (plan §9), not here.

describe('QuickTakeCard', () => {
  it('renders the lede under a Quick Take h2 and the bullets under a Key Takeaways h3 — one section', () => {
    const html = renderToString(createElement(QuickTakeCard, { lede: ' Two sentences. ', items: ['One line', ' Another '] }))
    expect(html.match(/<section/g)).toHaveLength(1)
    expect(html).toContain('<h2')
    expect(html).toContain('Quick Take')
    expect(html).toContain('Two sentences.')
    expect(html).toContain('<h3')
    expect(html).toContain('Key Takeaways')
    expect(html).toContain('Another')
    expect(html.match(/<li/g)).toHaveLength(2)
  })

  it('with bullets only the h2 is Key Takeaways and there is no h3; with a lede only there is no list', () => {
    const bullets = renderToString(createElement(QuickTakeCard, { items: ['One'] }))
    expect(bullets).toContain('<h2')
    expect(bullets).toContain('Key Takeaways')
    expect(bullets).not.toContain('<h3')
    expect(bullets).not.toContain('Quick Take')
    const lede = renderToString(createElement(QuickTakeCard, { lede: 'Just the gist.', items: [] }))
    expect(lede).toContain('Quick Take')
    expect(lede).not.toContain('<ul')
  })

  it('renders nothing when both halves are empty or blank', () => {
    expect(renderToString(createElement(QuickTakeCard, { lede: '  ', items: [' '] }))).toBe('')
    expect(renderToString(createElement(QuickTakeCard, {}))).toBe('')
  })
})

describe('blocks stage — the summary is asked for at a glance length', () => {
  const choices: BlockChoices = { tldr: true, keyTakeaways: true, faqs: false, bestFor: false, notFor: false, prosCons: false, subScores: false }
  type Shape = Record<string, { description?: string; safeParse: (v: unknown) => { success: boolean } }>

  it('the TL;DR and takeaways descriptions carry the word caps, and the hard caps are unchanged', () => {
    const guide = (blocksOutput(choices, 'guide') as unknown as { shape: Shape }).shape
    expect(guide.tldr.description).toContain('45 words at most')
    expect(guide.keyTakeaways.description).toContain('18 words at most')
    const review = (blocksOutput(choices, 'review') as unknown as { shape: Shape }).shape
    expect(review.tldr.description).toContain('40 words at most')
    // Asked for, never enforced: a long TL;DR still parses — a tripped .max() would discard the whole object.
    expect(guide.tldr.safeParse('w '.repeat(100)).success).toBe(true)
    expect(guide.keyTakeaways.safeParse(['a', 'b', 'c', 'd', 'e', 'f']).success).toBe(true)
  })
})
