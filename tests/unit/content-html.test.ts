import { describe, it, expect } from 'vitest'
import { assembleDraftHtml, htmlToStructuredText, paragraphsToHtml, stripAuthoringAttrs } from '@/lib/content/html'
import { buildPlaceholderFigure } from '@/lib/inlineImages'

// The one draft→HTML assembly (content pipeline plan Ph 0). Before this the four
// UI copies each wrapped the verdict/conclusion in a single <p>, dropping the
// paragraph break the prompt asks for.
describe('paragraphsToHtml', () => {
  it('splits on blank lines and keeps single newlines inside a paragraph', () => {
    expect(paragraphsToHtml('One line\nsame para.\n\nSecond para.')).toBe('<p>One line same para.</p>\n<p>Second para.</p>')
  })
  it('returns an empty string for nothing', () => {
    expect(paragraphsToHtml('')).toBe('')
    expect(paragraphsToHtml(null)).toBe('')
  })
})

describe('assembleDraftHtml', () => {
  it('wraps the intro, each section body and a multi-paragraph closing in <p>s', () => {
    const html = assembleDraftHtml({
      introduction: 'Intro para.',
      sections: [{ heading: 'Build', body: 'A.\n\nB.' }],
      closing: { heading: 'The Verdict', body: 'Buy it.\n\nBut not the pro model.' },
    })
    expect(html).toContain('<p>Intro para.</p>')
    expect(html).toContain('<h2>Build</h2>\n<p>A.</p>\n<p>B.</p>')
    expect(html).toContain('<h2>The Verdict</h2>\n<p>Buy it.</p>\n<p>But not the pro model.</p>')
  })

  it('places an image placeholder after its heading, matching case-insensitively', () => {
    const html = assembleDraftHtml({
      sections: [{ heading: 'Daily Use', body: 'x' }, { heading: 'Value', body: 'y' }],
      inlineImages: [{ afterHeading: 'daily use ', prompt: 'p', altText: 'alt "q"', caption: 'cap' }],
    })
    const daily = html.indexOf('<h2>Daily Use</h2>')
    const value = html.indexOf('<h2>Value</h2>')
    const fig = html.indexOf('<figure class="bd-image-placeholder"')
    expect(fig).toBeGreaterThan(daily)
    expect(fig).toBeLessThan(value)
    expect(html).toContain('data-slot-id="slot-1"')
    expect(html).toContain('data-alt="alt &quot;q&quot;"')
  })

  it('omits an empty closing', () => {
    const html = assembleDraftHtml({ sections: [{ heading: 'A', body: 'b' }], closing: { heading: 'Wrapping Up', body: '  ' } })
    expect(html).not.toContain('Wrapping Up')
  })

  it('writes the photo editor plan on each placeholder, and an owned one tells the author what to take', () => {
    const html = assembleDraftHtml({
      sections: [{ heading: 'Setup', body: 'x' }],
      inlineImages: [
        { afterHeading: 'Setup', prompt: '', altText: 'The sign-in screen', caption: '', need: 'owned', shot: 'medium', aspect: '4:5', ask: 'a screenshot of the sign-in screen' },
        { afterHeading: 'Setup', prompt: 'a long prompt', altText: 'A porch', caption: 'Cap', need: 'scene', shot: 'wide', aspect: '3:2' },
      ],
    })
    expect(html).toContain('data-slot-id="slot-1" data-prompt="" data-alt="The sign-in screen" data-caption="" data-need="owned" data-shot="medium" data-aspect="4:5" data-ask="a screenshot of the sign-in screen"><figcaption>Photo to take: a screenshot of the sign-in screen</figcaption>')
    expect(html).toContain('data-slot-id="slot-2" data-prompt="a long prompt" data-alt="A porch" data-caption="Cap" data-need="scene" data-shot="wide" data-aspect="3:2"><figcaption>Cap</figcaption>')
  })

  it('an image from an older run, with no plan, assembles exactly as before', () => {
    const html = assembleDraftHtml({
      sections: [{ heading: 'Setup', body: 'x' }],
      inlineImages: [{ afterHeading: 'Setup', prompt: 'p', altText: 'a', caption: 'c' }],
    })
    expect(html).toContain('<figure class="bd-image-placeholder" data-slot-id="slot-1" data-prompt="p" data-alt="a" data-caption="c"><figcaption>c</figcaption></figure>')
  })
})

describe('htmlToStructuredText', () => {
  it('keeps headings as "## " lines and paragraphs separated by blank lines, drops figures', () => {
    const text = htmlToStructuredText(
      '<p>Intro</p><h2>Build &amp; Feel</h2><p>One.</p><p>Two.</p><figure class="bd-image-filled" data-slot-id="s"><img src="x" alt="y" /></figure><ul><li>Pro</li></ul>',
    )
    expect(text).toBe('Intro\n\n## Build & Feel\n\nOne.\n\nTwo.\n\n- Pro')
  })
})

describe('stripAuthoringAttrs', () => {
  it('removes data-prompt/alt/caption from figures but keeps data-slot-id and the img', () => {
    const html = '<figure class="bd-image-filled" data-slot-id="slot-1" data-prompt="editorial photo" data-alt="a" data-caption="c"><img src="x.webp" alt="a" /><figcaption>c</figcaption></figure>'
    const out = stripAuthoringAttrs(html)
    expect(out).not.toContain('data-prompt')
    expect(out).not.toContain('data-alt')
    expect(out).not.toContain('data-caption')
    expect(out).toContain('data-slot-id="slot-1"')
    expect(out).toContain('<img src="x.webp" alt="a" />')
    expect(out).toContain('<figcaption>c</figcaption>')
  })
  it('leaves other markup alone', () => {
    const html = '<p>Hi</p><a href="/x" data-product-slug="y">buy</a>'
    expect(stripAuthoringAttrs(html)).toBe(html)
  })

  it('removes the photo editor plan too, keeping the slot id and the origin', () => {
    const html = '<figure class="bd-image-filled" data-slot-id="slot-1" data-prompt="p" data-alt="a" data-caption="c" data-need="owned" data-shot="detail" data-aspect="4:5" data-ask="a screenshot of the app" data-origin="own"><img src="x.webp" alt="a" /><figcaption>c</figcaption></figure>'
    const out = stripAuthoringAttrs(html)
    for (const attr of ['data-prompt', 'data-alt', 'data-caption', 'data-need', 'data-shot', 'data-aspect', 'data-ask']) {
      expect(out).not.toContain(attr)
    }
    expect(out).not.toContain('a screenshot of the app')
    expect(out).toContain('data-slot-id="slot-1"')
    expect(out).toContain('data-origin="own"')
    expect(out).toContain('<img src="x.webp" alt="a" />')
  })

  it('strips an ask that held a quote or an angle bracket (the writer entity-escapes it)', () => {
    const fig = buildPlaceholderFigure({ slotId: 's', need: 'owned', ask: 'the "A > B" menu' })
    expect(stripAuthoringAttrs(fig)).toBe('<figure class="bd-image-placeholder" data-slot-id="s"><figcaption>Photo to take: the &quot;A &gt; B&quot; menu</figcaption></figure>')
  })
})
