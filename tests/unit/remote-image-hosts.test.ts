import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { STATIC_IMAGE_HOSTS, imageHost, isRenderableImageUrl, supabaseImageHost } from '@/lib/images/remote-hosts'

describe('remote image hosts', () => {
  it('mirrors next.config.ts remotePatterns exactly (drift guard)', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
    const block = config.slice(config.indexOf('remotePatterns'), config.indexOf(']', config.indexOf('remotePatterns')))
    const literal = [...block.matchAll(/hostname:\s*'([^']+)'/g)].map((m) => m[1]).sort()
    expect(literal).toEqual([...STATIC_IMAGE_HOSTS].sort())
    // The one non-literal entry is the Supabase host, derived the same way.
    expect(block).toMatch(/hostname:\s*supabaseHostname/)
  })

  it('accepts our storage and the allowed CDNs, refuses everything else', () => {
    expect(isRenderableImageUrl(`https://${supabaseImageHost()}/storage/v1/object/public/media/a.webp`)).toBe(true)
    expect(isRenderableImageUrl('https://m.media-amazon.com/images/I/abc.jpg')).toBe(true)
    expect(isRenderableImageUrl('https://mobileimages.lowes.com/productimages/abc.jpg')).toBe(false)
    expect(isRenderableImageUrl('http://m.media-amazon.com/images/I/abc.jpg')).toBe(false) // https only
    expect(isRenderableImageUrl('not a url')).toBe(false)
  })

  it('reads the host, lowercased, from https URLs only', () => {
    expect(imageHost('https://Images.Unsplash.com/x.jpg')).toBe('images.unsplash.com')
    expect(imageHost('ftp://example.com/x.jpg')).toBeNull()
  })
})
