/**
 * Wrap binary data for a Supabase Storage upload, and verify what landed.
 *
 * ALWAYS use `toStorageBody()` instead of passing a Buffer or Uint8Array to
 * `storage.from(x).upload()`.
 *
 * WHY THIS EXISTS — two rounds of silent, production-only image corruption
 * (2026-07-28). Something in the deployed request path calls `String()` on a raw
 * upload body. The body type only changed which stringification ran:
 *
 *   Buffer      -> Buffer.toString('utf8')  -> every byte >= 0x80 becomes U+FFFD.
 *                  Stored a .webp reading `52 49 46 46 20 ef bf bd ...`
 *                  (RIFF + replacement chars), ~49,000 U+FFFD runs.
 *   Uint8Array  -> Array.prototype.toString -> comma-separated decimals.
 *                  Stored a .webp reading `82,73,70,70,238,...` — which is
 *                  literally "RIFF" spelled out as numbers.
 *
 * Both arrive with a plausible size and a correct mimetype, so nothing errors and
 * nothing logs. And both were invisible locally: the local runtime accepts a raw
 * binary body and writes the correct bytes, so only uploads written from the
 * deployed runtime were destroyed.
 *
 * THE FIX is to avoid the raw-body path altogether. `@supabase/storage-js`
 * (StorageFileApi.uploadOrUpdate) branches on `fileBody instanceof Blob` and
 * builds a multipart `FormData` request, never touching the raw-body code that
 * stringifies. That is also the path every browser upload takes, so it is the
 * best-tested one in the library.
 *
 * NOTE: on the Blob path the stored mimetype comes from `blob.type`, NOT from the
 * `contentType` upload option — which is why contentType is a required argument
 * here rather than something callers can forget.
 */
export function toStorageBody(data: Buffer | Uint8Array, contentType: string): Blob {
  // Copy into a fresh array rather than wrapping `data.buffer` directly. Two
  // reasons: pooled Buffers sit inside a larger ArrayBuffer (so passing `.buffer`
  // would upload the whole pool), and a Buffer's backing store is typed
  // `ArrayBufferLike` — possibly a SharedArrayBuffer, which is not a valid
  // BlobPart. `set()` copies exactly this view's bytes. One copy of an image is
  // not worth optimizing away.
  const bytes = new Uint8Array(data.byteLength)
  bytes.set(data)
  return new Blob([bytes], { type: contentType })
}

/** Leading bytes that identify each image container we store. */
const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  'image/webp': (b) => str(b, 0, 4) === 'RIFF' && str(b, 8, 12) === 'WEBP',
  'image/png': (b) => b[0] === 0x89 && str(b, 1, 4) === 'PNG',
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
}

function str(b: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...b.subarray(from, to))
}

/**
 * Read back the first bytes of a just-uploaded object and confirm the container
 * signature survived the trip.
 *
 * This exists because the corruption above was *silent* — a stringified body still
 * produces a stored object with a sane size and the right mimetype, so the only
 * symptom was an image that renders nowhere, discovered by a human days later. One
 * cheap range read turns that into a loud failure at write time.
 *
 * Returns null when intact, or a description of what landed instead.
 */
export async function verifyStoredMagic(
  storage: { download: (path: string) => Promise<{ data: Blob | null; error: unknown }> },
  path: string,
  contentType: string,
): Promise<string | null> {
  const check = MAGIC[contentType]
  if (!check) return null // nothing to assert for this type

  const { data, error } = await storage.download(path)
  if (error || !data) return `could not read back ${path} to verify`

  const head = new Uint8Array((await data.arrayBuffer()).slice(0, 16))
  if (check(head)) return null

  const hex = Array.from(head)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
  const ascii = str(head, 0, 16).replace(/[^\x20-\x7e]/g, '.')
  return `expected ${contentType} signature, got: ${hex}  ("${ascii}")`
}
