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
})
