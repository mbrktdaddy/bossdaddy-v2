import { describe, it, expect } from 'vitest'
import { dedupeSizeVariants, isLikelyGraphic } from '@/lib/images/candidates'

describe('dedupeSizeVariants', () => {
  it('keeps the largest of size-token variants, in first-seen position', () => {
    const out = dedupeSizeVariants([
      'https://x.com/DCD801B_1_800.webp',
      'https://x.com/other.png',
      'https://x.com/DCD801B_1_1680.webp',
    ])
    expect(out).toEqual(['https://x.com/DCD801B_1_1680.webp', 'https://x.com/other.png'])
  })

  it('keeps a different extension separate', () => {
    const out = dedupeSizeVariants(['https://x.com/DCD801B_1_1680.webp', 'https://x.com/DCD801B_1.jpg'])
    expect(out).toHaveLength(2)
  })

  it('reads WxH tokens and w= params', () => {
    expect(dedupeSizeVariants(['https://x.com/a-300x200.jpg', 'https://x.com/a-1200x800.jpg'])).toEqual(['https://x.com/a-1200x800.jpg'])
    expect(dedupeSizeVariants(['https://x.com/a.jpg?w=200', 'https://x.com/a.jpg?w=900'])).toEqual(['https://x.com/a.jpg?w=900'])
  })

  it('keeps the first when there is no size info', () => {
    expect(dedupeSizeVariants(['https://x.com/a.jpg?v=1', 'https://x.com/a.jpg?v=2'])).toEqual(['https://x.com/a.jpg?v=1'])
  })
})

describe('isLikelyGraphic', () => {
  it('flags logos and banners', () => {
    expect(isLikelyGraphic('https://x.com/img/brand-logo.png')).toBe(true)
    expect(isLikelyGraphic('https://x.com/Banner_1.jpg')).toBe(true)
  })
  it('passes product photos', () => {
    expect(isLikelyGraphic('https://x.com/DCD801B_1_1680.webp')).toBe(false)
  })
})
