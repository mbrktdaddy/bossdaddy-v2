// Fails the build if a Supabase Storage `.upload()` call passes anything other
// than `toStorageBody(...)` or an explicit Blob/File.
//
// Guards the 2026-07-28 corruption (fixed in b02caa6): the deployed runtime calls
// String() on a RAW upload body, so the bytes are destroyed and the body type only
// decides how. Both of these shipped corrupt images to production:
//
//   Buffer      -> Buffer.toString('utf8')   -> bytes >= 0x80 become U+FFFD
//   Uint8Array  -> Array.prototype.toString  -> "82,73,70,70,..." (RIFF as decimals)
//
// Only a Blob escapes it, because @supabase/storage-js branches on `instanceof
// Blob` and builds a multipart FormData request that never touches the raw-body
// path. See lib/storage-body.ts.
//
// ⚠️ `new Uint8Array(...)` is therefore NOT an accepted body here, even though it
// is the correct thing to pass to a Response (`app/api/media/download/route.ts`).
// This allow-list previously included it — written against the first, wrong theory
// that the bug was Buffer-specific — which would have greenlit the exact pattern
// that corrupted two more images. Uploads and responses have different rules.
//
// Deliberately a string check, not a type check: `Buffer` IS a `Uint8Array`
// subclass, so TypeScript cannot tell these apart at the call site.

import { readFileSync, globSync } from 'node:fs'

const FILES = globSync(['app/**/*.ts', 'lib/**/*.ts']).filter(
  (p) => !p.includes('node_modules') && !p.includes('_archive'),
)

// Matches `.upload(<arg1>, <arg2>` on a SINGLE line. Every real call site in the
// repo keeps its first two args together; staying newline-free is what stops the
// pattern from running out of a prose mention of `.upload()` in a doc comment and
// swallowing unrelated text as "arguments".
const UPLOAD_CALL = /\.upload\(\s*([^,\n]+),\s*([^,\n{)]+)/g

// Body forms that cannot reach the String(body) fallback. NOTE the absence of
// `new Uint8Array(` — see the header. Only Blob-shaped bodies are safe to upload.
const SAFE = /^(toStorageBody\(|new Blob\(|new File\(|file$|blob$)/

const violations = []

for (const file of FILES) {
  const src = readFileSync(file, 'utf8')
  if (!src.includes('.upload(')) continue

  for (const m of src.matchAll(UPLOAD_CALL)) {
    const body = m[2].trim()
    if (SAFE.test(body)) continue

    // Skip matches that live inside a comment.
    const before = src.slice(0, m.index)
    const line = before.split('\n').length
    const lineText = src.split('\n')[line - 1].trim()
    if (lineText.startsWith('//') || lineText.startsWith('*') || lineText.startsWith('/*')) continue

    violations.push({ file, line, body })
  }
}

if (violations.length) {
  console.error('\n✖ Unsafe Supabase Storage upload body:\n')
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  .upload(…, ${v.body}, …)`)
  }
  console.error(
    '\n  The deployed runtime calls String() on a raw upload body. Buffer becomes a' +
      '\n  UTF-8 decode (bytes >= 0x80 -> U+FFFD); Uint8Array becomes "82,73,70,70,...".' +
      '\n  Either way the file is silently destroyed — correct mimetype, plausible size,' +
      '\n  renders nowhere, and it only happens in production.' +
      '\n' +
      '\n  Only a Blob is safe here: .upload(path, toStorageBody(buffer, "image/webp"), …)' +
      '\n  (see lib/storage-body.ts — and note a Response body has different rules)\n',
  )
  process.exit(1)
}

console.log(`✓ Storage upload bodies: ${FILES.length} files scanned, every upload() passes a Web-spec body`)
