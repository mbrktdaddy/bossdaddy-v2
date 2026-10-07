import { describe, it, expect } from 'vitest'
import { parseUploadOrigin } from '@/lib/media/origin'

describe('parseUploadOrigin', () => {
  it('accepts own and drops any url', () => {
    expect(parseUploadOrigin('own', 'https://x.com')).toEqual({ origin: 'own', origin_url: null })
  })

  it('keeps a valid web url', () => {
    expect(parseUploadOrigin('web', 'https://brand.com/p/1')).toEqual({
      origin: 'web',
      origin_url: 'https://brand.com/p/1',
    })
  })

  it('web with an invalid url keeps origin, drops url', () => {
    expect(parseUploadOrigin('web', 'not a url')).toEqual({ origin: 'web', origin_url: null })
    expect(parseUploadOrigin('web', undefined)).toEqual({ origin: 'web', origin_url: null })
  })

  it('web with a javascript: url drops the url', () => {
    expect(parseUploadOrigin('web', 'javascript:alert(1)')).toEqual({ origin: 'web', origin_url: null })
  })

  it('web with an over-long url drops the url', () => {
    expect(parseUploadOrigin('web', 'https://x.com/' + 'a'.repeat(2100)).origin_url).toBeNull()
  })

  it('garbage origin becomes null', () => {
    expect(parseUploadOrigin('banana', 'https://x.com')).toEqual({ origin: null, origin_url: null })
    expect(parseUploadOrigin(42, null)).toEqual({ origin: null, origin_url: null })
  })

  it('rejects amazon and ai from uploads', () => {
    expect(parseUploadOrigin('amazon', null).origin).toBeNull()
    expect(parseUploadOrigin('ai', null).origin).toBeNull()
  })
})
