// Fails the build if a Supabase Storage `.upload()` call passes anything other
// than `toStorageBody(...)` (or an explicit Blob/File).
//
// Guards the 2026-07-28 corruption bug: handing a Node `Buffer` to
// `storage.upload()` works locally but is UTF-8-stringified by the deployed
// runtime, writing silently mangled bytes that still carry a plausible size and
// a correct mimetype. Nothing errors, nothing logs — the image just renders
// nowhere. See lib/storage-body.ts for the full mechanism.
//
// Deliberately a string check, not a type check: `Buffer` IS a `Uint8Array`
// subclass, so TypeScript cannot tell the safe case from the unsafe one here.

import { readFileSync, globSync } from 'node:fs'

const FILES = globSync(['app/**/*.ts', 'lib/**/*.ts']).filter(
  (p) => !p.includes('node_modules') && !p.includes('_archive'),
)

// Matches `.upload(<arg1>, <arg2>` on a SINGLE line. Every real call site in the
// repo keeps its first two args together; staying newline-free is what stops the
// pattern from running out of a prose mention of `.upload()` in a doc comment and
// swallowing unrelated text as "arguments".
const UPLOAD_CALL = /\.upload\(\s*([^,\n]+),\s*([^,\n{)]+)/g

// Body forms that cannot reach the String(body) fallback.
const SAFE = /^(toStorageBody\(|new Uint8Array\(|new Blob\(|file$|blob$)/

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
    '\n  A Node Buffer is not a Web BodyInit. The deployed runtime stringifies it,' +
      '\n  UTF-8-corrupting every byte >= 0x80 — silently, and only in production.' +
      '\n  Wrap it: .upload(path, toStorageBody(buffer), …)  (see lib/storage-body.ts)\n',
  )
  process.exit(1)
}

console.log(`✓ Storage upload bodies: ${FILES.length} files scanned, every upload() passes a Web-spec body`)
