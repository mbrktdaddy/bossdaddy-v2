import 'server-only'

// The guarded HTTP client for link previews. ./net-guard.ts decides what is
// allowed; this enforces it on a real socket.
//
// ── WHY node:http AND NOT fetch() ─────────────────────────────────────────────
// Because of DNS rebinding, which is the failure mode a "validate the hostname,
// then fetch it" implementation always has. Between our lookup and the stack's
// lookup, an attacker-controlled DNS server can answer differently: first a public
// address to pass validation, then 127.0.0.1 for the connection. The window is
// small and entirely automatable.
//
// The only way to close it is to resolve the name ourselves, validate every
// address, and then connect TO THE ADDRESS WE VALIDATED. Node's http/https accept
// a `lookup` option for exactly this. `fetch` (undici) has no equivalent that
// doesn't mean depending on undici internals, so we drop a level instead.
//
// Connecting by hostname with our own resolver — rather than rewriting the URL to
// the IP — also keeps TLS working: the certificate is still verified against the
// name, which an IP-in-the-URL approach breaks.

import http from 'node:http'
import https from 'node:https'
import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import type { LookupFunction } from 'node:net'
import { isPublicAddress, normalizeUrl } from './net-guard'

/** Total budget for one hop. Someone else's slow server is not our problem to wait on. */
const HOP_TIMEOUT_MS = 5_000
/** Redirect hops. Enough for the http→https→www chain every real site has; not enough to be a maze. */
const MAX_REDIRECTS = 3
/** We only need the <head>. Anything past this is a download, not a page. */
export const MAX_HTML_BYTES = 512 * 1024
/** A preview thumbnail. Bigger than this is not a thumbnail. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Identifies us honestly, and points at a page explaining the traffic. */
const USER_AGENT = 'BossDaddyLinkPreview/1.0 (+https://www.bossdaddylife.com/about)'

export type FetchFailure =
  | 'blocked'      // the guard refused the URL or a resolved address
  | 'dns'          // the name doesn't resolve
  | 'timeout'
  | 'too-large'
  | 'bad-status'
  | 'bad-type'
  | 'too-many-redirects'
  | 'network'

export interface GuardedResponse {
  url:         string   // the FINAL url, after redirects
  contentType: string
  body:        Buffer
}

/**
 * A `lookup` implementation that only ever yields addresses we have approved.
 *
 * ⚠️ REJECTS IF *ANY* RESOLVED ADDRESS IS PRIVATE, rather than filtering the list
 * down to the public ones. A name that answers with both a public and a private
 * address is not a mistake we should route around — it is the signature of the
 * attack, and picking the "good" one would let a host keep trying until a race
 * lands. One bad answer poisons the name.
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    // `LookupFunction`'s callback is overloaded (one address, or an array when
    // `options.all` is set) in a way TS can't narrow from a runtime flag, so the
    // dispatch below is cast at the call. The VALUES are correct either way — this
    // is a typing seam, not a behavioural one.
    const done = callback as (
      err: NodeJS.ErrnoException | null,
      address?: string | LookupAddress[],
      family?: number,
    ) => void

    if (err) return done(err)
    if (!addresses || addresses.length === 0) {
      return done(Object.assign(new Error('no address'), { code: 'ENOTFOUND' }))
    }
    for (const entry of addresses) {
      if (!isPublicAddress(entry.address)) {
        return done(Object.assign(new Error(`blocked address ${entry.address}`), { code: 'EBLOCKED' }))
      }
    }
    if (options && typeof options === 'object' && options.all === true) return done(null, addresses)
    return done(null, addresses[0].address, addresses[0].family)
  })
}

/** One hop. No redirect following — the caller does that so it can re-validate. */
function hop(
  target: string,
  maxBytes: number,
): Promise<
  | { ok: true; status: number; headers: http.IncomingHttpHeaders; body: Buffer }
  | { ok: false; reason: FetchFailure }
> {
  return new Promise((resolve) => {
    let parsed: URL
    try { parsed = new URL(target) } catch { return resolve({ ok: false, reason: 'blocked' }) }

    const transport = parsed.protocol === 'https:' ? https : http
    let settled = false
    const finish = (result: Awaited<ReturnType<typeof hop>>) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const request = transport.request(
      target,
      {
        method: 'GET',
        lookup: guardedLookup,
        headers: {
          'User-Agent': USER_AGENT,
          // Ask for what we can actually use. Some sites serve a very different
          // (and much smaller) document to a client that doesn't claim to want
          // everything.
          Accept: 'text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5',
          'Accept-Language': 'en',
        },
        // Never send or store credentials for a third party.
        agent: false,
      },
      (response) => {
        const chunks: Buffer[] = []
        let received = 0

        // Trust the declared length when it's obviously too big, so a large file is
        // refused before a single byte of body arrives.
        const declared = Number(response.headers['content-length'] ?? 0)
        if (declared > maxBytes) {
          response.destroy()
          return finish({ ok: false, reason: 'too-large' })
        }

        response.on('data', (chunk: Buffer) => {
          received += chunk.length
          // The real cap: a chunked response can lie about (or omit) its length,
          // so the stream is killed the moment it crosses the line.
          if (received > maxBytes) {
            response.destroy()
            return finish({ ok: false, reason: 'too-large' })
          }
          chunks.push(chunk)
        })
        response.on('end', () => finish({
          ok: true,
          status: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks),
        }))
        response.on('error', () => finish({ ok: false, reason: 'network' }))
      },
    )

    request.setTimeout(HOP_TIMEOUT_MS, () => {
      request.destroy()
      finish({ ok: false, reason: 'timeout' })
    })

    request.on('error', (err: NodeJS.ErrnoException) => {
      // EBLOCKED is our own resolver refusing the address — report it as blocked
      // rather than as a generic network blip, so the cached reason is truthful.
      finish({ ok: false, reason: err.code === 'EBLOCKED' ? 'blocked' : 'network' })
    })

    request.end()
  })
}

/**
 * Fetch a URL with every guard applied, following redirects manually.
 *
 * ⚠️ EACH HOP GOES BACK THROUGH normalizeUrl AND THE GUARDED RESOLVER. This is the
 * other half of the SSRF story: a public, innocuous URL is allowed to 302 straight
 * at 169.254.169.254, and a client that validates only the URL it was given walks
 * into it. Following redirects by hand is the only way to check the ones we weren't
 * handed.
 */
export async function guardedFetch(
  rawUrl: string,
  { maxBytes, expect }: { maxBytes: number; expect: 'html' | 'image' },
): Promise<{ ok: true; data: GuardedResponse } | { ok: false; reason: FetchFailure }> {
  let current = rawUrl

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const normalized = normalizeUrl(current)
    if (!normalized.ok) return { ok: false, reason: 'blocked' }

    const result = await hop(normalized.url, maxBytes)
    if (!result.ok) return { ok: false, reason: result.reason }

    const { status, headers, body } = result

    if (status >= 300 && status < 400) {
      const location = headers.location
      if (!location) return { ok: false, reason: 'bad-status' }
      // Resolved against the current URL, so a relative Location works — and so a
      // scheme-relative `//evil.example` can't smuggle a different protocol in.
      try {
        current = new URL(location, normalized.url).toString()
      } catch {
        return { ok: false, reason: 'blocked' }
      }
      continue
    }

    if (status < 200 || status >= 300) return { ok: false, reason: 'bad-status' }

    const contentType = String(headers['content-type'] ?? '').toLowerCase()
    const typeOk = expect === 'html'
      ? contentType.includes('text/html') || contentType.includes('application/xhtml')
      : contentType.startsWith('image/')
    if (!typeOk) return { ok: false, reason: 'bad-type' }

    return { ok: true, data: { url: normalized.url, contentType, body } }
  }

  return { ok: false, reason: 'too-many-redirects' }
}
