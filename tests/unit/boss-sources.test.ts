import { describe, it, expect } from 'vitest'
import { toSourceBlock } from '@/lib/boss/sources'

describe('toSourceBlock', () => {
  it('labels an X post by handle', () => {
    expect(toSourceBlock('https://x.com/gulf_news/status/2103319201637138881')).toMatchObject({
      kind: 'source',
      origin: 'x',
      label: '@gulf_news',
      title: '@gulf_news',
    })
  })

  it('labels a handle-less x.com/i/status link generically', () => {
    expect(toSourceBlock('https://x.com/i/status/2103066914935468422')).toMatchObject({
      origin: 'x',
      label: 'Post on X',
    })
  })

  it('labels a web page by bare domain and decodes &amp; in the URL', () => {
    const b = toSourceBlock('https://www.news.google.com/read/abc?hl=en-US&amp;gl=US', 'Xi visit &amp; trade')
    expect(b).toMatchObject({ origin: 'web', label: 'news.google.com', title: 'Xi visit & trade' })
    expect(b?.url).toBe('https://www.news.google.com/read/abc?hl=en-US&gl=US')
  })

  it('rejects non-http(s) and malformed URLs', () => {
    expect(toSourceBlock('javascript:alert(1)')).toBeNull()
    expect(toSourceBlock('data:text/html,hi')).toBeNull()
    expect(toSourceBlock('not a url')).toBeNull()
  })
})
