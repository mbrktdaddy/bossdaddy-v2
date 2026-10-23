import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { OutlineEditor } from '@/components/workspace/OutlineEditor'
import type { Outline } from '@/lib/content/pipeline/types'

// The facts field syncs its raw text from the outline during render. The
// model's notes arrive untrimmed ("  fact ", ""), and a sync that compared the
// parsed text to the RAW list never settled — React threw "Too many
// re-renders" and the outline step went blank. A server render runs the same
// render-phase updates, so it catches the loop without a DOM.

function outline(notes: string[]): Outline {
  return {
    title: 'T', titleOptions: ['T'], excerpt: 'E',
    parts: [
      { kind: 'intro', heading: '', intent: 'open', notes, targetWords: 60, productToken: null },
      { kind: 'body', heading: 'B', intent: 'body', notes: ['plain fact'], targetWords: 200, productToken: null },
      { kind: 'closing', heading: 'C', intent: 'close', notes: [], targetWords: 120, productToken: null },
    ],
    blocks: { tldr: true, keyTakeaways: true, faqs: false, bestFor: false, notFor: false, prosCons: false, subScores: false },
    imageCount: 0, related: [], duplicateWarning: null,
  }
}

const render = (notes: string[]) =>
  renderToString(createElement(OutlineEditor, {
    outline: outline(notes), contentType: 'guide', busy: false, onSave: () => {}, onCancel: () => {},
  }))

describe('OutlineEditor facts field', () => {
  it('renders untrimmed and empty model notes without a render loop', () => {
    expect(() => render(['  padded fact  ', '', 'second\tfact ', '   '])).not.toThrow()
  })

  it('shows the notes as typed text, one per line', () => {
    const html = render(['first fact', 'second fact'])
    expect(html).toContain('first fact\nsecond fact')
  })

  it('renders an empty notes list', () => {
    expect(() => render([])).not.toThrow()
  })
})
