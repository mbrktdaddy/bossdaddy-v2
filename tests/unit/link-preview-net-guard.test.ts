// The SSRF boundary. Unfurling fetches a URL A MEMBER TYPED from our own
// infrastructure, so every case below is an attack somebody would actually try —
// the cloud metadata endpoint most of all, because on many platforms it hands out
// credentials to anything that asks it.
//
// These are the tests that justify the feature existing at all. If one of them
// starts failing, the correct response is to stop unfurling, not to skip the test.

import { describe, it, expect } from 'vitest'
import { normalizeUrl, isPublicAddress } from '@/lib/link-preview/net-guard'

const rejects = (url: string) => {
  const out = normalizeUrl(url)
  return out.ok === false
}

describe('normalizeUrl — what we refuse to fetch', () => {
  it('accepts ordinary http and https links', () => {
    expect(normalizeUrl('https://example.com/page')).toEqual({ ok: true, url: 'https://example.com/page' })
    expect(normalizeUrl('http://example.com/')).toEqual({ ok: true, url: 'http://example.com/' })
  })

  it('refuses every scheme but http and https', () => {
    for (const url of [
      'file:///etc/passwd',
      'ftp://example.com/x',
      'gopher://example.com/',
      'data:text/html,hi',
      'javascript:alert(1)',
      'jar:http://example.com!/',
    ]) {
      expect(rejects(url), url).toBe(true)
    }
  })

  // An IP literal is never a link somebody meant to share, and refusing the SHAPE
  // is one fewer parser to get right than normalizing decimal/octal/hex/IPv6 forms.
  it('refuses IP literals in every notation', () => {
    for (const url of [
      'http://127.0.0.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://2130706433/',       // decimal 127.0.0.1
      'http://0x7f.0x0.0x0.0x1/', // hex
      'http://017700000001/',     // octal
    ]) {
      expect(rejects(url), url).toBe(true)
    }
  })

  // Otherwise the preview card reports whether an internal service answered on a
  // given port — a scanner with a friendly UI.
  it('refuses non-web ports', () => {
    for (const port of [22, 25, 3306, 5432, 6379, 8080, 9200, 11211]) {
      expect(rejects(`http://example.com:${port}/`), String(port)).toBe(true)
    }
  })

  it('allows the explicit web ports', () => {
    expect(normalizeUrl('http://example.com:80/').ok).toBe(true)
    expect(normalizeUrl('https://example.com:443/').ok).toBe(true)
  })

  it('refuses a hostname with no dot', () => {
    // Resolves through the search domain on a lot of infrastructure, and on plenty
    // of it that means something internal.
    expect(rejects('http://localhost/')).toBe(true)
    expect(rejects('http://metadata/')).toBe(true)
    expect(rejects('http://redis/')).toBe(true)
  })

  it('refuses absurdly long input and non-URLs', () => {
    expect(rejects(`https://example.com/${'a'.repeat(3000)}`)).toBe(true)
    expect(rejects('not a url at all')).toBe(true)
    expect(rejects('')).toBe(true)
  })

  it('strips the fragment, which the origin never sees anyway', () => {
    const out = normalizeUrl('https://example.com/page#section')
    expect(out.ok && out.url).toBe('https://example.com/page')
  })

  // A query routinely decides WHICH page you get, so dropping it would cache the
  // wrong preview under the right key.
  it('keeps the query string', () => {
    const out = normalizeUrl('https://example.com/search?q=strollers&page=2')
    expect(out.ok && out.url).toContain('q=strollers')
    expect(out.ok && out.url).toContain('page=2')
  })

  it('drops embedded credentials', () => {
    const out = normalizeUrl('https://user:pass@example.com/x')
    expect(out.ok && out.url).toBe('https://example.com/x')
    expect(out.ok && out.url).not.toContain('pass')
  })
})

describe('isPublicAddress — IPv4', () => {
  it('allows real public addresses', () => {
    for (const ip of ['1.1.1.1', '8.8.8.8', '93.184.216.34', '151.101.1.69']) {
      expect(isPublicAddress(ip), ip).toBe(true)
    }
  })

  // ⚠️ 169.254.169.254 is the cloud instance metadata endpoint. This is the single
  // most important line in the file.
  it('blocks the cloud metadata endpoint', () => {
    expect(isPublicAddress('169.254.169.254')).toBe(false)
  })

  it('blocks loopback, private, and link-local ranges', () => {
    for (const ip of [
      '127.0.0.1', '127.1.2.3',
      '10.0.0.1', '10.255.255.255',
      '172.16.0.1', '172.31.255.255',
      '192.168.0.1', '192.168.255.255',
      '169.254.0.1',
      '0.0.0.0',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false)
    }
  })

  it('allows the addresses just outside the private blocks', () => {
    // The classic off-by-one: 172.16/12 ends at 172.31, so 172.32 is public.
    expect(isPublicAddress('172.15.255.255')).toBe(true)
    expect(isPublicAddress('172.32.0.1')).toBe(true)
    expect(isPublicAddress('11.0.0.1')).toBe(true)
    expect(isPublicAddress('192.167.255.255')).toBe(true)
  })

  it('blocks CGNAT, benchmark, test-net, multicast and reserved space', () => {
    for (const ip of [
      '100.64.0.1', '100.127.255.255',
      '198.18.0.1',
      '192.0.2.1', '198.51.100.1', '203.0.113.1',
      '224.0.0.1', '239.255.255.255',
      '240.0.0.1', '255.255.255.255',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false)
    }
  })

  it('fails closed on malformed addresses', () => {
    for (const value of ['', 'not-an-ip', '1.2.3', '1.2.3.4.5', '999.1.1.1', '10.0.0.01']) {
      expect(isPublicAddress(value), value).toBe(false)
    }
  })
})

describe('isPublicAddress — IPv6', () => {
  it('allows a real public v6 address', () => {
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true)
    expect(isPublicAddress('2a00:1450:4009:81f::200e')).toBe(true)
  })

  // THE CLASSIC BYPASS: check the v6 form, see "some 2000:: looking thing", allow
  // it — while the last four bytes are 127.0.0.1 and the kernel routes it there.
  it('blocks IPv4-mapped addresses by their embedded IPv4', () => {
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false)
    expect(isPublicAddress('::ffff:169.254.169.254')).toBe(false)
    expect(isPublicAddress('::ffff:10.0.0.1')).toBe(false)
    // …and still allows a mapped PUBLIC address, so the check is on the value and
    // not just on the shape.
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true)
  })

  it('blocks NAT64-embedded private addresses', () => {
    expect(isPublicAddress('64:ff9b::127.0.0.1')).toBe(false)
    expect(isPublicAddress('64:ff9b::169.254.169.254')).toBe(false)
  })

  it('blocks loopback, unspecified, unique-local, link-local and multicast', () => {
    for (const ip of [
      '::1', '::',
      'fc00::1', 'fd12:3456::1',
      'fe80::1', 'fe80::abcd:1234',
      'ff02::1',
      '100::1',
      '2001:db8::1',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false)
    }
  })

  it('ignores a zone index rather than choking on it', () => {
    expect(isPublicAddress('fe80::1%eth0')).toBe(false)
  })

  it('fails closed on malformed v6', () => {
    for (const value of ['1:2:3', '::ffff:1.2.3', 'gggg::1', '1::2::3']) {
      expect(isPublicAddress(value), value).toBe(false)
    }
  })
})
