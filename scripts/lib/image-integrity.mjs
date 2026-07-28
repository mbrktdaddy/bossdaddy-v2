// Detects the UTF-8 corruption fixed in 569b0a2 (see lib/storage-body.ts).
//
// When binary is round-tripped through a UTF-8 decode, every byte >= 0x80 that
// isn't part of a valid UTF-8 sequence becomes U+FFFD (EF BF BD). Image magic
// bytes are the tell: they sit at offset 0 and almost always contain a high byte,
// so they break first while the ASCII parts (like "RIFF") survive intact.
//
// Extracted from the audit script so it can be unit-tested — tests/unit/
// image-integrity.test.ts validates it against a real image and a genuinely
// mangled copy of that same image.

const FFFD = Buffer.from([0xef, 0xbf, 0xbd])

/** Identify a file by magic bytes. 'unknown' means the header is not a known image. */
export function magicOf(buf) {
  if (buf.length < 12) return 'too-short'
  const ascii = buf.subarray(0, 12).toString('latin1')
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'webp'
  if (buf[0] === 0x89 && ascii.slice(1, 4) === 'PNG') return 'png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (ascii.startsWith('GIF8')) return 'gif'
  return 'unknown'
}

/**
 * Detect the SECOND corruption form: the byte array serialized by
 * Array.prototype.toString, i.e. `"82,73,70,70,238,..."`. Those leading numbers
 * are the decimal codes for R, I, F, F — a WebP spelled out as text.
 *
 * This form contains no U+FFFD at all (every character is ASCII), so the
 * replacement-character heuristic misses it completely and it would otherwise be
 * filed as merely 'suspect'.
 */
export function isStringifiedByteArray(buf) {
  if (buf.length < 32) return false
  // Require the ENTIRE header to be digits and commas. Deliberately not a
  // "starts with N numbers" pattern — that was brittle about exactly how many
  // groups it demanded. A real image container cannot look like this: every known
  // format puts a non-numeric byte in its magic. The trailing slice may cut
  // mid-number, which is why a bare digit run is allowed at the end.
  const head = buf.subarray(0, 64).toString('latin1')
  return /^[0-9]+(,[0-9]+)*,?$/.test(head)
}

/** Count non-overlapping U+FFFD (EF BF BD) sequences. */
export function countFFFD(buf) {
  let n = 0
  let i = buf.indexOf(FFFD)
  while (i !== -1) {
    n++
    i = buf.indexOf(FFFD, i + 3)
  }
  return n
}

// A mass of U+FFFD is by itself conclusive, so this doesn't need corroboration
// from the magic bytes. The exact 3-byte sequence EF BF BD occurs by chance with
// probability 2^-24 per offset, so a 1MB file of compressed image data should
// contain ~0.06 of them. Finding 100+ is not a coincidence.
//
// This threshold is what catches the case broken magic bytes alone would miss: if
// a WebP's 4-byte size field happens to hold only low bytes, it survives the round
// trip, "WEBP" stays at offset 8, and the header still validates — while every
// scanline behind it is destroyed.
const FFFD_CONCLUSIVE = 100

/**
 * Classify a stored object as 'ok' | 'corrupt' | 'suspect'.
 *
 * 'suspect' exists so an ambiguous file (a non-image, something truncated) is
 * escalated to a human instead of being called unrecoverable — a false 'corrupt'
 * here could get a healthy file deleted.
 */
export function classify(buf) {
  const magic = magicOf(buf)
  const fffd = countFFFD(buf)
  const healthy = magic !== 'unknown' && magic !== 'too-short'

  // Conclusive on its own — no image container starts with decimal text.
  if (isStringifiedByteArray(buf)) {
    return { verdict: 'corrupt', magic: 'stringified-byte-array', fffd }
  }

  // "RIFF" is pure ASCII so it survives, but the 4-byte size field after it often
  // doesn't — which slides the WEBP marker off offset 8. Both real-world corrupted
  // files looked exactly like this (`52 49 46 46 2c ef bf bd`).
  const riffButNotWebp = buf.subarray(0, 4).toString('latin1') === 'RIFF' && magic !== 'webp'

  if (fffd >= FFFD_CONCLUSIVE) return { verdict: 'corrupt', magic, fffd }
  if (riffButNotWebp && fffd > 0) return { verdict: 'corrupt', magic, fffd }
  if (healthy && fffd === 0) return { verdict: 'ok', magic, fffd }
  return { verdict: 'suspect', magic, fffd }
}
