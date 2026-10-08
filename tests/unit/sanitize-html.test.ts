import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '@/lib/sanitize'

// sanitizeHtml() is the XSS boundary for every piece of rich user/AI content
// written to the DB (reviews, guides, collections). These pin its behaviour so
// a sanitize-html upgrade (or an options edit) that changes either what real
// content keeps or what an attack payload loses fails here, not in production.
//
// Content-shape cases assert exact output; attack cases assert what must never
// survive, so harmless upstream formatting changes don't cause false failures.

describe('sanitizeHtml — real content shapes are preserved', () => {
  it('keeps headings, inline emphasis, entities and non-ASCII text', () => {
    expect(sanitizeHtml(
      '<h2>I used this for 3 weekends</h2><p>The <strong>grill</strong> held 225&deg; &amp; never flinched — “really” it’s great. Café, naïve, Łukasz.</p>',
    )).toBe(
      '<h2>I used this for 3 weekends</h2><p>The <strong>grill</strong> held 225° &amp; never flinched — “really” it’s great. Café, naïve, Łukasz.</p>',
    )
  })

  it('merges noopener/noreferrer into an affiliate link’s existing rel and keeps BUY tokens', () => {
    expect(sanitizeHtml(
      '<p><a href="https://amzn.to/abc" rel="sponsored nofollow" target="_blank" data-product-slug="weber-kettle">Weber</a> [[BUY:weber-kettle]]</p>',
    )).toBe(
      '<p><a href="https://amzn.to/abc" rel="sponsored nofollow noopener noreferrer" target="_blank" data-product-slug="weber-kettle">Weber</a> [[BUY:weber-kettle]]</p>',
    )
  })

  it('adds rel to a relative link and keeps mailto', () => {
    expect(sanitizeHtml('<a href="/reviews/x">rel</a>')).toBe('<a href="/reviews/x" rel="noopener noreferrer">rel</a>')
    expect(sanitizeHtml('<a href="mailto:hello@bossdaddylife.com">mail</a>'))
      .toBe('<a href="mailto:hello@bossdaddylife.com" rel="noopener noreferrer">mail</a>')
  })

  it('keeps inline-image figures with their slot metadata', () => {
    const figure = '<figure class="bd-figure" data-slot-id="s1" data-prompt="dad at grill" data-alt="Dad" data-caption="Sunday"><img src="https://x.supabase.co/a.jpg" alt="Dad" width="800" height="600" data-slot-id="s1" /><figcaption>Sunday cook</figcaption></figure>'
    expect(sanitizeHtml(figure.replace(' />', '>'))).toBe(figure)
  })

  it('keeps content-component divs (and data: images) but strips unknown div classes', () => {
    expect(sanitizeHtml(
      '<div class="bd-image-grid"><img src="data:image/png;base64,iVBORw0KGgo="></div><div class="junk-layout">x</div><div class="bd-collection-embed" data-collection-slug="grill-kit"></div><div class="bd-content-link" data-content-type="guide" data-content-slug="smoke-101"></div>',
    )).toBe(
      '<div class="bd-image-grid"><img src="data:image/png;base64,iVBORw0KGgo=" /></div><div>x</div><div class="bd-collection-embed" data-collection-slug="grill-kit"></div><div class="bd-content-link" data-content-type="guide" data-content-slug="smoke-101"></div>',
    )
  })

  it('keeps lists, blockquotes and code blocks', () => {
    const html = '<ul><li>One</li><li>Two <em>it</em></li></ul><ol><li>A</li></ol><blockquote><p>Quote</p></blockquote><pre><code>const x = 1 &lt; 2</code></pre>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('discards disallowed tags but keeps their text', () => {
    expect(sanitizeHtml('<p>5 &lt; 10, <span style="color:red">span</span>, <table><tr><td>cell</td></tr></table></p>'))
      .toBe('<p>5 &lt; 10, span, </p>cell<p></p>')
  })
})

describe('sanitizeHtml — attack payloads never survive', () => {
  it.each([
    ['script tag',            '<p>hi</p><script>alert(1)</script>',                 /<script|alert\(1\)/i],
    ['style tag',             '<style>p{color:red}</style><p>x</p>',                /<style/i],
    ['event handler',         '<img src="https://ok/a.jpg" onerror="alert(1)">',    /onerror|alert/i],
    ['javascript: href',      '<a href="javascript:alert(1)">js</a>',               /javascript:|href=/i],
    ['tab-obfuscated scheme', '<a href="jav&#x09;ascript:alert(1)">tab</a>',        /javascript|href=/i],
    ['zero-padded entity',    '<a href="&#0000106avascript:alert(1)">z</a>',        /javascript|href=/i],
    ['protocol-relative URL', '<a href="//evil.com">pr</a>',                        /evil\.com/i],
    ['iframe',                '<iframe src="https://evil.com"></iframe>',           /<iframe|evil\.com/i],
    ['noscript breakout',     '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></p></noscript>', /onerror|alert/i],
    ['meta refresh',          '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">', /<meta|javascript/i],
    ['srcset scheme',         '<img srcset="javascript:alert(1) 1x" src="https://ok/a.jpg">',   /javascript|srcset/i],
    ['svg',                   '<svg><animate attributeName="href" values="javascript:alert(1)"/></svg>', /<svg|<animate|javascript/i],
    ['inline style attr',     '<p style="background:url(javascript:alert(1))">x</p>', /style=|javascript/i],
  ])('%s', (_label, dirty, forbidden) => {
    expect(sanitizeHtml(dirty)).not.toMatch(forbidden)
  })

  it('re-sanitizes a stripped iframe’s fallback markup instead of escaping it', () => {
    expect(sanitizeHtml('<iframe src="https://evil.com"><b>fallback</b> text</iframe>')).toBe('<b>fallback</b> text')
  })
})
