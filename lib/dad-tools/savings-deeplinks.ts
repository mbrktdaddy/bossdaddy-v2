// Builds deep-link URLs that open the user's payment app (PayPal / Venmo /
// Cash App) prefilled with the amount and recipient. The user confirms the
// actual transfer inside their own app — we never move money.
//
// Returns `null` when the destination can't be deep-linked (Zelle has no
// public deep link; manual destinations are just labels).

import type { DestinationType } from './savings'

// Each normalizer returns `{ handle }` for amount-prefilled deep links, or
// `{ openAsIs: <url> }` when the input is a URL we don't know how to inject
// an amount into (short links like py.pl, generic profile URLs). The caller
// uses openAsIs verbatim — the user still gets to their payment app, they
// just type the amount themselves.

interface NormalizedDest {
  handle?:    string
  openAsIs?:  string
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s)
}

function normalizePayPalDest(raw: string): NormalizedDest {
  const trimmed = raw.trim().replace(/^@/, '')
  // paypal.me/handle (with or without protocol) → handle for amount prefill
  const meMatch = trimmed.match(/paypal\.me\/([^/?#]+)/i)
  if (meMatch) return { handle: meMatch[1] }
  // Any other URL (py.pl short link, paypal.com profile, etc.) → open as-is
  if (isHttpUrl(trimmed)) return { openAsIs: trimmed }
  // Bare handle
  return { handle: trimmed }
}

function normalizeVenmoDest(raw: string): NormalizedDest {
  const trimmed = raw.trim().replace(/^@/, '')
  const urlMatch = trimmed.match(/venmo\.com\/(?:u\/)?([^/?#]+)/i)
  if (urlMatch) return { handle: urlMatch[1] }
  if (isHttpUrl(trimmed)) return { openAsIs: trimmed }
  return { handle: trimmed }
}

function normalizeCashDest(raw: string): NormalizedDest {
  const trimmed = raw.trim().replace(/^\$/, '')
  const urlMatch = trimmed.match(/cash\.app\/\$?([^/?#]+)/i)
  if (urlMatch) return { handle: urlMatch[1] }
  if (isHttpUrl(trimmed)) return { openAsIs: trimmed }
  return { handle: trimmed }
}

function fmtAmount(amount: number): string {
  // Two decimals max, no trailing zeros (PayPal accepts "2" but Venmo's
  // amount parser is happier with "2.00" — pick the safe form).
  return amount.toFixed(2)
}

export interface DeeplinkInput {
  type:        DestinationType | null
  handleOrUrl: string | null
  amount:      number
  note?:       string | null
}

// Returns the URL to open, or `null` if the destination can't be deep-linked
// (Zelle, manual, missing handle).
export function buildPaymentDeeplink(input: DeeplinkInput): string | null {
  if (!input.handleOrUrl || input.amount <= 0) return null

  const amt = fmtAmount(input.amount)
  const note = input.note ? encodeURIComponent(input.note) : ''

  switch (input.type) {
    case 'paypal': {
      const dest = normalizePayPalDest(input.handleOrUrl)
      if (dest.openAsIs) return dest.openAsIs
      if (!dest.handle) return null
      return `https://paypal.me/${encodeURIComponent(dest.handle)}/${amt}USD`
    }
    case 'venmo': {
      const dest = normalizeVenmoDest(input.handleOrUrl)
      if (dest.openAsIs) return dest.openAsIs
      if (!dest.handle) return null
      // The `venmo://paycharge` scheme is Venmo's documented deep-link format
      // and reliably launches the Venmo app on iOS and Android. The HTTPS
      // `venmo.com/?txn=...` form is universal-link dependent and frequently
      // falls back to a browser tab — bad UX for the "tap Yes, confirm in app"
      // loop. `audience=private` keeps the transaction off the public feed.
      const params = new URLSearchParams({
        txn:        'pay',
        audience:   'private',
        recipients: dest.handle,
        amount:     amt,
      })
      if (note) params.set('note', input.note ?? '')
      return `venmo://paycharge?${params.toString()}`
    }
    case 'cashapp': {
      const dest = normalizeCashDest(input.handleOrUrl)
      if (dest.openAsIs) return dest.openAsIs
      if (!dest.handle) return null
      return `https://cash.app/$${encodeURIComponent(dest.handle)}/${amt}`
    }
    case 'zelle':
    case 'manual':
    case null:
    default:
      return null
  }
}

// True when the destination type + URL combo will pre-fill the amount.
// Lets the UI surface "(amount will pre-fill)" vs "(enter amount in app)".
// Empty/whitespace handles return false — an empty paypal.me/handle isn't
// a real prefill target, no matter what the type column says.
export function destinationSupportsAmountPrefill(
  type: DestinationType | null,
  handleOrUrl: string | null,
): boolean {
  if (!handleOrUrl || !handleOrUrl.trim()) return false
  switch (type) {
    case 'paypal': {
      const dest = normalizePayPalDest(handleOrUrl)
      return !dest.openAsIs && !!dest.handle
    }
    case 'venmo': {
      const dest = normalizeVenmoDest(handleOrUrl)
      return !dest.openAsIs && !!dest.handle
    }
    case 'cashapp': {
      const dest = normalizeCashDest(handleOrUrl)
      return !dest.openAsIs && !!dest.handle
    }
    default: return false
  }
}

// User-friendly label for the destination chip / button.
export function destinationDisplayName(type: DestinationType | null): string {
  switch (type) {
    case 'paypal':  return 'PayPal'
    case 'venmo':   return 'Venmo'
    case 'cashapp': return 'Cash App'
    case 'zelle':   return 'Zelle'
    case 'manual':  return 'Manual'
    default:        return 'Set up destination'
  }
}

// Auto-detect the destination type from a free-form URL or handle. Returns
// `null` when we can't tell — the URL will still open as-is on Yes tap, just
// without amount prefill.
//
// Patterns we recognize for amount prefill:
//   PayPal:    paypal.me/handle              → handle-based prefill works
//              paypal.com/paypalme/...       → openAsIs (PayPal handles the rest)
//              py.pl/...  (short links)     → openAsIs
//              paypal.com/pools/c/...       → openAsIs (Pool contribution)
//   Venmo:     venmo.com/handle              → handle-based prefill works
//   Cash App:  cash.app/$tag                 → handle-based prefill works
export function detectDestinationType(urlOrHandle: string | null): DestinationType | null {
  if (!urlOrHandle) return null
  const lower = urlOrHandle.toLowerCase().trim()
  if (!lower) return null
  if (/(paypal\.me\/|paypal\.com\/(?:paypalme|pools)\/|py\.pl\/)/i.test(lower)) return 'paypal'
  if (/venmo\.com\//i.test(lower))   return 'venmo'
  if (/cash\.app\//i.test(lower))    return 'cashapp'
  // Bare handles with `@` or `$` prefix
  if (lower.startsWith('@'))         return 'venmo'   // common Venmo convention
  if (lower.startsWith('$'))         return 'cashapp' // Cash App convention
  return null
}

// Describes how the destination will behave at "Yes" tap time. Used by the
// form to show inline detection feedback, and by the action panel to choose
// between deep-link redirect vs. log-only confirmation.
export interface DestinationBehavior {
  type:          DestinationType | null   // detected (or null when unknown)
  willOpenUrl:   boolean                  // tapping Yes will navigate the browser
  willPrefill:   boolean                  // amount will pre-fill in the app
  message:       string                   // short copy for the form / button
}

export function describeDestination(urlOrHandle: string | null): DestinationBehavior {
  if (!urlOrHandle || !urlOrHandle.trim()) {
    return {
      type: null,
      willOpenUrl: false,
      willPrefill: false,
      message: 'No URL — tapping Yes will log the commitment only.',
    }
  }
  const type = detectDestinationType(urlOrHandle)
  // To know if amount prefills, run the URL through the builder with a probe
  // amount; if the result matches the .me/handle/amount template, prefill
  // works. If we just open the URL as-is, the amount field stays empty in
  // the user's app.
  const prefill = type != null && destinationSupportsAmountPrefill(type, urlOrHandle)
  if (type && prefill) {
    return {
      type, willOpenUrl: true, willPrefill: true,
      message: `Detected as ${destinationDisplayName(type)} — amount will pre-fill.`,
    }
  }
  if (type) {
    return {
      type, willOpenUrl: true, willPrefill: false,
      message: `Detected as ${destinationDisplayName(type)} — opens the page, you enter the amount.`,
    }
  }
  return {
    type: null, willOpenUrl: true, willPrefill: false,
    message: 'Opens this URL when you tap Yes — you enter the amount.',
  }
}
