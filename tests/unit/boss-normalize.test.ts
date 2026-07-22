import { describe, it, expect } from 'vitest'
import { normalizeBossText } from '@/lib/boss/normalizeText'

// Proves the render-time markdown backstop independent of the model/gateway (the
// eval can't exercise Haiku's markdown leakage on a free-tier key). These are the
// exact patterns the golden eval's MARKDOWN rule flags.
describe('normalizeBossText', () => {
  it('strips **bold** to plain text', () => {
    expect(normalizeBossText('The **best overall** pick')).toBe('The best overall pick')
    expect(normalizeBossText('***really*** good')).toBe('really good')
  })

  it('strips ATX headings but keeps the heading text', () => {
    expect(normalizeBossText('# Title\nbody')).toBe('Title\nbody')
    expect(normalizeBossText('### Sub head')).toBe('Sub head')
  })

  it('converts dash/star bullets to "• " bullets, preserving indent', () => {
    expect(normalizeBossText('- cheap\n- light')).toBe('• cheap\n• light')
    expect(normalizeBossText('* one\n  * two')).toBe('• one\n  • two')
  })

  it('leaves already-correct "• " bullets and plain prose untouched', () => {
    expect(normalizeBossText('• cheap\n• light')).toBe('• cheap\n• light')
    expect(normalizeBossText('No tested pick yet — here is the research.')).toBe(
      'No tested pick yet — here is the research.',
    )
  })

  it('does not mangle URLs, hashtags, or lone asterisks', () => {
    expect(normalizeBossText('see https://a.com/x_y and #dadlife')).toBe(
      'see https://a.com/x_y and #dadlife',
    )
    expect(normalizeBossText('2 * 3 = 6')).toBe('2 * 3 = 6')
  })

  it('leaves the output clean of the eval MARKDOWN patterns', () => {
    const MARKDOWN = /(\*\*[^*]+\*\*|^\s{0,3}#{1,6}\s|^\s*[-*]\s)/m
    const raw = '## Picks\n- **Best overall** — the X\n- light and cheap'
    expect(MARKDOWN.test(raw)).toBe(true)
    expect(MARKDOWN.test(normalizeBossText(raw))).toBe(false)
  })

  // ── Cards own the links (PR 2a compliance backstop) ──
  it('drops a whole line that is just a link reference', () => {
    const raw =
      "This is the one — 1,181 lbs of cedar.\nReview: /reviews/gorilla-wilderness-gym\nBuy link (affiliate, no extra cost to you): /go/gorilla-wilderness-gym"
    expect(normalizeBossText(raw)).toBe('This is the one — 1,181 lbs of cedar.')
  })

  it('strips a bare inline internal path but keeps the surrounding prose', () => {
    expect(normalizeBossText('The full review /reviews/some-slug covers the rest.')).toBe(
      'The full review covers the rest.',
    )
    expect(normalizeBossText('Grab it here (/go/some-slug).')).toBe('Grab it here.')
  })

  it('never leaves a bare /reviews//guides//go/ path in the output', () => {
    const BARE = /(?<![\w.])\/(?:reviews|guides|go)\/[a-z0-9-]+/i
    const raw =
      'Shower shaving is the move.\nGuide: /guides/shaving-in-the-shower\nStill helps: see /reviews/foo and /go/bar too.'
    expect(BARE.test(raw)).toBe(true)
    expect(BARE.test(normalizeBossText(raw))).toBe(false)
  })

  it('does not mangle absolute URLs that merely contain the path segments', () => {
    // The lookbehind spares a full URL — only bare relative paths are stripped.
    expect(normalizeBossText('see https://bossdaddylife.com/reviews/x for more')).toBe(
      'see https://bossdaddylife.com/reviews/x for more',
    )
  })

  it('preserves a legit "label:" lead-in line that has no link path', () => {
    expect(normalizeBossText("Here's the deal:\n• sharp blade\n• shave with the grain")).toBe(
      "Here's the deal:\n• sharp blade\n• shave with the grain",
    )
  })
})
