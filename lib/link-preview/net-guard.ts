// SSRF hardening for the link-preview fetcher.
//
// This module is the security boundary of the whole feature. Unfurling takes a URL
// a MEMBER TYPED and fetches it FROM OUR INFRASTRUCTURE, which is the textbook
// server-side request forgery shape: whatever our function can reach — the metadata
// endpoint, a database on the private network, a service listening on localhost —
// the attacker can now reach by pasting a link into a DM and reading the preview
// card that comes back.
//
// Everything here is pure and synchronous so it can be exhaustively tested. The
// async half (which enforces these decisions on a live socket, including on every
// redirect hop) is in ./fetch.ts.
//
// ── THE FOUR THINGS THAT HAVE TO HOLD ────────────────────────────────────────
//   1. http/https only. Not file:, not gopher:, not ftp:.
//   2. Ports 80/443 only — otherwise the preview card becomes a port scanner that
//      reports back whether an internal service answered.
//   3. Every RESOLVED ADDRESS is public. Not the hostname: `localtest.me` and any
//      attacker-owned domain can have an A record pointing at 127.0.0.1, so
//      hostname allow/deny lists are theatre. The IP is the thing.
//   4. The socket connects to the address we VALIDATED. Validating a name and then
//      letting the stack resolve it again is a DNS-rebinding hole: the second
//      lookup can return a different, private address. ./fetch.ts closes this by
//      supplying its own resolver.

import { isIP } from 'node:net'

/** Ports we will connect to. Anything else turns previews into a port scanner. */
const ALLOWED_PORTS = new Set([80, 443])

export type UrlRejection =
  | 'not-a-url'
  | 'bad-scheme'
  | 'bad-port'
  | 'is-ip-literal'
  | 'too-long'

/** Absurd URLs are not real links and cost real time downstream. */
const MAX_URL_LENGTH = 2048

/**
 * Normalize a URL for use as a cache key, and reject what we will not fetch.
 *
 * IP LITERALS ARE REJECTED OUTRIGHT rather than range-checked. A real shared link
 * has a hostname; `http://169.254.169.254/latest/meta-data/` does not, and refusing
 * the entire shape is one fewer parser to get right than normalizing every
 * representation an IP can take (decimal, octal, hex, IPv4-in-IPv6, `[::]`).
 * Range checks still run on the RESOLVED address — this is belt and braces.
 */
export function normalizeUrl(input: string): { ok: true; url: string } | { ok: false; reason: UrlRejection } {
  if (input.length > MAX_URL_LENGTH) return { ok: false, reason: 'too-long' }

  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return { ok: false, reason: 'not-a-url' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'bad-scheme' }
  }

  // An empty `port` means the scheme default, which is always allowed.
  if (parsed.port !== '' && !ALLOWED_PORTS.has(Number(parsed.port))) {
    return { ok: false, reason: 'bad-port' }
  }

  // Strip the brackets IPv6 hostnames carry in a URL before testing.
  const host = parsed.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) !== 0) return { ok: false, reason: 'is-ip-literal' }

  // A hostname with no dot is either a local machine name or a search-domain
  // lookup, and neither is a link somebody meant to share.
  if (!parsed.hostname.includes('.')) return { ok: false, reason: 'not-a-url' }

  // The fragment never reaches the server, so keeping it would split the cache on
  // a difference the origin can't even see. Everything else is preserved: a query
  // string routinely decides which page you get, so stripping it would cache the
  // wrong preview under the right key.
  parsed.hash = ''
  // Credentials in a URL are a redirect-and-leak vector and are never needed here.
  parsed.username = ''
  parsed.password = ''

  return { ok: true, url: parsed.toString() }
}

/** IPv4 dotted-quad → unsigned 32-bit, or null if it isn't one. */
function ipv4ToInt(address: string): number | null {
  const parts = address.split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    // Reject empty, non-numeric, and leading-zero forms — `010` is octal to some
    // resolvers and decimal to others, and that disagreement is exploitable.
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    value = value * 256 + n
  }
  return value >>> 0
}

function inV4Block(value: number, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split('/')
  const bits = Number(bitsRaw)
  const baseInt = ipv4ToInt(base)
  if (baseInt === null) return false
  // A /0 mask can't be expressed by shifting 32 bits in JS; no block here uses it.
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (value & mask) === (baseInt & mask)
}

/**
 * Every IPv4 range that is not a routable public host.
 *
 * 169.254.0.0/16 is the one to never lose: it holds 169.254.169.254, the cloud
 * instance metadata endpoint, which is the single highest-value SSRF target there
 * is — on many platforms it hands out credentials to anything that asks.
 */
const V4_BLOCKED = [
  '0.0.0.0/8',        // "this network" / unspecified
  '10.0.0.0/8',       // RFC1918 private
  '100.64.0.0/10',    // CGNAT — carrier-internal, reachable from some hosts
  '127.0.0.0/8',      // loopback
  '169.254.0.0/16',   // link-local — INCLUDES CLOUD METADATA
  '172.16.0.0/12',    // RFC1918 private
  '192.0.0.0/24',     // IETF protocol assignments
  '192.0.2.0/24',     // TEST-NET-1
  '192.88.99.0/24',   // 6to4 relay anycast (deprecated)
  '192.168.0.0/16',   // RFC1918 private
  '198.18.0.0/15',    // benchmarking
  '198.51.100.0/24',  // TEST-NET-2
  '203.0.113.0/24',   // TEST-NET-3
  '224.0.0.0/4',      // multicast
  '240.0.0.0/4',      // reserved (covers 255.255.255.255 broadcast)
]

/** Expand an IPv6 address to its 16 bytes, or null if it doesn't parse. */
function ipv6ToBytes(address: string): Uint8Array | null {
  let text = address
  // A zone index (fe80::1%eth0) is not part of the address.
  const zone = text.indexOf('%')
  if (zone !== -1) text = text.slice(0, zone)

  // An IPv4-mapped or NAT64 tail (::ffff:1.2.3.4) — convert it to two hex groups
  // so the rest of the parser only deals with hextets.
  const tail = text.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (tail) {
    const v4 = ipv4ToInt(tail[1])
    if (v4 === null) return null
    const hi = (v4 >>> 16).toString(16)
    const lo = (v4 & 0xffff).toString(16)
    text = `${text.slice(0, tail.index)}${hi}:${lo}`
  }

  const halves = text.split('::')
  if (halves.length > 2) return null

  const head = halves[0] ? halves[0].split(':') : []
  const tailGroups = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : null

  let groups: string[]
  if (tailGroups === null) {
    groups = head
    if (groups.length !== 8) return null
  } else {
    const fill = 8 - head.length - tailGroups.length
    if (fill < 0) return null
    groups = [...head, ...Array(fill).fill('0'), ...tailGroups]
  }

  const bytes = new Uint8Array(16)
  for (let i = 0; i < 8; i++) {
    const group = groups[i]
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null
    const n = parseInt(group, 16)
    bytes[i * 2] = n >> 8
    bytes[i * 2 + 1] = n & 0xff
  }
  return bytes
}

/**
 * Is this address one we're willing to connect to?
 *
 * FAILS CLOSED. Anything unparseable is treated as blocked, because the only
 * reason we can't parse an address is that we don't understand it, and "I don't
 * understand this address" is not a reason to connect to it.
 */
export function isPublicAddress(address: string): boolean {
  const kind = isIP(address)

  if (kind === 4) {
    const value = ipv4ToInt(address)
    if (value === null) return false
    return !V4_BLOCKED.some((cidr) => inV4Block(value, cidr))
  }

  if (kind === 6) {
    const bytes = ipv6ToBytes(address)
    if (bytes === null) return false

    // IPv4-mapped (::ffff:0:0/96) and NAT64 (64:ff9b::/96) both carry a real IPv4
    // address in the last four bytes. Checking the v6 form alone would let
    // ::ffff:127.0.0.1 through as "some public v6 address" — the classic bypass.
    const isV4Mapped =
      bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff
    const isNat64 =
      bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b &&
      bytes.slice(4, 12).every((b) => b === 0)
    if (isV4Mapped || isNat64) {
      const embedded = ((bytes[12] << 24) | (bytes[13] << 16) | (bytes[14] << 8) | bytes[15]) >>> 0
      return !V4_BLOCKED.some((cidr) => inV4Block(embedded, cidr))
    }

    if (bytes.every((b) => b === 0)) return false                 // :: unspecified
    if (bytes.slice(0, 15).every((b) => b === 0) && bytes[15] === 1) return false // ::1 loopback
    if ((bytes[0] & 0xfe) === 0xfc) return false                  // fc00::/7 unique-local
    if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return false // fe80::/10 link-local
    if (bytes[0] === 0xff) return false                           // ff00::/8 multicast
    if (bytes[0] === 0x01 && bytes[1] === 0x00 &&
        bytes.slice(2, 8).every((b) => b === 0)) return false      // 100::/64 discard
    if (bytes[0] === 0x20 && bytes[1] === 0x01 &&
        bytes[2] === 0x0d && bytes[3] === 0xb8) return false       // 2001:db8::/32 docs

    return true
  }

  // Not an IP at all — a hostname reached this by mistake. Fail closed.
  return false
}
