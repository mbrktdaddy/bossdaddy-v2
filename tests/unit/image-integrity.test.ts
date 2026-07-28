import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { classify, magicOf, countFFFD } from '../../scripts/lib/image-integrity.mjs'

// Guards the detector behind scripts/audit-storage-corruption.mjs, which decides
// which stored images are unrecoverable. A false 'corrupt' verdict could push
// someone into deleting a healthy file, so this validates against a real image
// AND against a genuinely mangled copy produced by the exact mechanism that
// caused the production bug (569b0a2): a UTF-8 decode/re-encode round trip.

const HEALTHY = readFileSync('public/images/bd-logo-icon.png')

/** Reproduces the bug: String(buffer) is a UTF-8 decode, then it's re-encoded. */
function utf8Mangle(buf: Buffer): Buffer {
  return Buffer.from(buf.toString('utf8'), 'utf8')
}

describe('image-integrity detector', () => {
  it('reads a real PNG as healthy', () => {
    expect(magicOf(HEALTHY)).toBe('png')
    expect(countFFFD(HEALTHY)).toBe(0)
    expect(classify(HEALTHY).verdict).toBe('ok')
  })

  it('flags the same image as corrupt after a UTF-8 round trip', () => {
    const broken = utf8Mangle(HEALTHY)
    const result = classify(broken)

    expect(result.verdict).toBe('corrupt')
    // The PNG signature starts with 0x89 — a high byte, so it dies first.
    expect(result.magic).not.toBe('png')
    expect(result.fffd).toBeGreaterThan(100)
    // Mangling must actually have changed the bytes, or the test proves nothing.
    expect(broken.equals(HEALTHY)).toBe(false)
  })

  /** "RIFF" + 4-byte LE size + "WEBP" + a payload of high bytes. */
  function synthWebp(size: number): Buffer {
    const sizeField = Buffer.alloc(4)
    sizeField.writeUInt32LE(size, 0)
    const payload = Buffer.alloc(4096)
    for (let i = 0; i < payload.length; i++) payload[i] = 0x80 + (i % 0x7f)
    return Buffer.concat([Buffer.from('RIFF'), sizeField, Buffer.from('WEBP'), payload])
  }

  it('catches the real-world case — RIFF survives but WEBP slides off offset 8', () => {
    // 0x0002BEE0 → bytes E0 BE 02 00. The two high bytes die, displacing the
    // marker. This is what both actually-corrupted production files looked like.
    const webp = synthWebp(0x0002_bee0)
    expect(magicOf(webp)).toBe('webp')
    expect(classify(webp).verdict).toBe('ok')

    const broken = utf8Mangle(webp)
    expect(broken.subarray(0, 4).toString('latin1')).toBe('RIFF') // ASCII survived
    expect(magicOf(broken)).not.toBe('webp') // marker displaced
    expect(classify(broken).verdict).toBe('corrupt')
  })

  it('catches a corrupt payload even when the header survives intact', () => {
    // 0x00012C20 → bytes 20 2C 01 00, all < 0x80, so the size field and the WEBP
    // marker both survive the round trip and the header still validates. Only the
    // U+FFFD mass reveals that every scanline behind it is destroyed. Relying on
    // broken magic bytes alone would misfile this as merely 'suspect'.
    const broken = utf8Mangle(synthWebp(0x0001_2c20))

    expect(magicOf(broken)).toBe('webp') // header looks fine
    expect(classify(broken).verdict).toBe('corrupt') // caught anyway
  })

  it('catches the stringified-byte-array form, which contains no U+FFFD at all', () => {
    // The second production corruption: Array.prototype.toString on the body.
    // `String(new Uint8Array([82,73,70,70]))` === '82,73,70,70' — "RIFF" as decimals.
    const broken = Buffer.from(String(new Uint8Array(HEALTHY)), 'utf8')

    expect(countFFFD(broken)).toBe(0) // the U+FFFD heuristic is blind to this
    expect(broken.subarray(0, 16).toString('latin1')).toMatch(/^[0-9]+,[0-9]+/)
    expect(classify(broken).verdict).toBe('corrupt')
    expect(classify(broken).magic).toBe('stringified-byte-array')
  })

  it('does not mistake a real image for a stringified array', () => {
    expect(classify(HEALTHY).verdict).toBe('ok')
    expect(classify(utf8Mangle(HEALTHY)).magic).not.toBe('stringified-byte-array')
  })

  it('returns suspect rather than corrupt when only one signal fires', () => {
    // Unknown magic but no replacement chars — e.g. a non-image file. Not our bug.
    const plainText = Buffer.from('just some ascii text, not an image at all')
    expect(classify(plainText).verdict).toBe('suspect')

    // Too short to judge.
    expect(classify(Buffer.from([0x89, 0x50])).verdict).toBe('suspect')
  })
})
