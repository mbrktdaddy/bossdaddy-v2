/**
 * Wrap binary data for a Supabase Storage upload.
 *
 * ALWAYS use this instead of handing a Node `Buffer` to `storage.from(x).upload()`.
 *
 * WHY THIS EXISTS — it fixed silent, production-only image corruption (2026-07-28).
 * `@supabase/storage-js` only special-cases `Blob` and `FormData` bodies; anything
 * else is passed straight through to `fetch` as the raw request body. A Node
 * `Buffer` is not part of the Web `BodyInit` union, so a runtime that fails to
 * recognize it as a TypedArray falls back to `String(body)` — a UTF-8 decode that
 * replaces every byte >= 0x80 with U+FFFD (`EF BF BD`).
 *
 * The damage was invisible locally, because local Node accepts `Buffer` as a body
 * and writes the correct bytes. Only uploads written from the deployed runtime were
 * mangled, and they still arrived with a plausible size and a correct `image/webp`
 * mimetype, so nothing errored and nothing logged. A generated hero image landed in
 * storage as `RIFF 20 ef bf bd ...` with ~49,000 U+FFFD runs and the `WEBP` marker
 * shoved off its offset — a file that looks fine in a listing and renders nowhere.
 *
 * A plain `Uint8Array` IS in `BodyInit`, so it can't take that fallback path. The
 * returned view shares memory with the input (no copy) and is correctly windowed
 * with byteOffset/byteLength, which matters because pooled `Buffer`s often sit
 * inside a larger ArrayBuffer — passing `buf.buffer` alone would upload the whole
 * pool. `app/api/img/route.ts` already wrapped its response body this way.
 *
 * `scripts/check-storage-upload-body.mjs` fails the build if a new `.upload()` call
 * site skips this.
 */
export function toStorageBody(data: Buffer | Uint8Array): Uint8Array {
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}
