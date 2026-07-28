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

  // "RIFF" is pure ASCII so it survives, but the 4-byte size field after it often
  // doesn't — which slides the WEBP marker off offset 8. Both real-world corrupted
  // files looked exactly like this (`52 49 46 46 2c ef bf bd`).
  const riffButNotWebp = buf.subarray(0, 4).toString('latin1') === 'RIFF' && magic !== 'webp'

  if (fffd >= FFFD_CONCLUSIVE) return { verdict: 'corrupt', magic, fffd }
  if (riffButNotWebp && fffd > 0) return { verdict: 'corrupt', magic, fffd }
  if (healthy && fffd === 0) return { verdict: 'ok', magic, fffd }
  return { verdict: 'suspect', magic, fffd }
}
