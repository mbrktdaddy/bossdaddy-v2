import { describe, it, expect } from 'vitest'
import { htmlToStructuredText, inlineMarksToHtml, paragraphsToHtml } from '@/lib/content/html'

// The light-Markdown subset a staged section may use (docs/rich-elements-plan.md §2).
// Literal expectations: the rendered HTML IS the contract with the sanitizer + CSS.

describe('paragraphsToHtml — the Markdown subset', () => {
  it('renders a bulleted list from "- " lines and a numbered list from "1." lines', () => {
    expect(paragraphsToHtml('- one\n- two\n* three')).toBe('<ul>\n<li>one</li>\n<li>two</li>\n<li>three</li>\n</ul>')
    expect(paragraphsToHtml('1. first\n2. second\n3) third')).toBe('<ol>\n<li>first</li>\n<li>second</li>\n<li>third</li>\n</ol>')
  })
  it('splits a lead-in sentence glued to its list without a blank line', () => {
    expect(paragraphsToHtml('Do this in order:\n1. Strap it.\n2. Check it.')).toBe('<p>Do this in order:</p>\n<ol>\n<li>Strap it.</li>\n<li>Check it.</li>\n</ol>')
  })
  it('renders ### as an H3 and "> " lines as one pull-quote', () => {
    expect(paragraphsToHtml('### The strap test\n\n> One line worth re-reading.\n> Continued.')).toBe('<h3>The strap test</h3>\n<blockquote><p>One line worth re-reading. Continued.</p></blockquote>')
  })
  it('renders bold lead-ins and italics inside paragraphs and list items', () => {
    expect(paragraphsToHtml('**Check the straps.** Then *walk* away.\n\n- **Weight:** 4 lb')).toBe(
      '<p><strong>Check the straps.</strong> Then <em>walk</em> away.</p>\n<ul>\n<li><strong>Weight:</strong> 4 lb</li>\n</ul>',
    )
  })
  it('leaves # / ## headings, tables and code fences literal so the mistake is visible', () => {
    expect(paragraphsToHtml('## Not allowed\n\n| a | b |\n\n```\ncode\n```')).toBe('<p>## Not allowed</p>\n<p>| a | b |</p>\n<p>``` code ```</p>')
  })
  it('does not italicise a bare asterisk in prose or a multiplication', () => {
    expect(inlineMarksToHtml('3 * 4 = 12 and a*b')).toBe('3 * 4 = 12 and a*b')
    expect(inlineMarksToHtml('snake_case_name stays')).toBe('snake_case_name stays')
  })
  it('a lone year or count sentence is a paragraph, not a one-item numbered list', () => {
    expect(paragraphsToHtml('2024. That was the year.')).toBe('<p>2024. That was the year.</p>')
    expect(paragraphsToHtml("3. That's how many trips it took.")).toBe("<p>3. That's how many trips it took.</p>")
    expect(paragraphsToHtml("Count them.\n3. That's how many.")).toBe("<p>Count them. 3. That's how many.</p>")
    // A single bullet is still unambiguous.
    expect(paragraphsToHtml('- only one')).toBe('<ul>\n<li>only one</li>\n</ul>')
  })
  it('keeps the pre-2026-10-25 behaviour for plain paragraphs', () => {
    expect(paragraphsToHtml('One line\nsame para.\n\nSecond para.')).toBe('<p>One line same para.</p>\n<p>Second para.</p>')
  })
})

describe('htmlToStructuredText round-trips lists', () => {
  it('numbered lists come back as "1." lines and bullets as "- " lines', () => {
    const html = paragraphsToHtml('Lead.\n\n1. a\n2. b\n\n- x\n- y')
    expect(htmlToStructuredText(html)).toBe('Lead.\n\n1. a\n2. b\n\n- x\n- y')
    // And back again, byte-for-byte.
    expect(paragraphsToHtml(htmlToStructuredText(html))).toBe(html)
  })
})
