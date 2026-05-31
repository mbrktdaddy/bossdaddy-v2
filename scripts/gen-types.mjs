#!/usr/bin/env node
// Regenerate Supabase TypeScript types — SAFELY.
//
// Why this exists instead of a plain `supabase gen types ... > file`:
// a shell `>` redirect truncates the target file BEFORE the command runs,
// so any failure (most commonly an unauthenticated CLI → "Unauthorized")
// leaves database.types.ts EMPTY and breaks the build. This script captures
// stdout in memory and only overwrites the file when generation clearly
// succeeded, so a failed run leaves your existing types untouched.
//
// Run via: npm run db:types   (npm puts node_modules/.bin on PATH so the
// local `supabase` CLI resolves).

import { spawnSync } from 'node:child_process'
import { writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const PROJECT_ID = 'fsxbertkzcigvkdyqgep'
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'supabase', 'database.types.ts')

// Pass the whole command as one string (not args + shell:true) to avoid Node's
// DEP0190 warning. PROJECT_ID is a hard-coded constant, so there's no injection
// surface here. shell:true is needed so the `supabase` .cmd shim resolves on Windows.
const result = spawnSync(
  `supabase gen types typescript --project-id ${PROJECT_ID}`,
  { encoding: 'utf8', shell: true },
)

const out = result.stdout ?? ''
const err = (result.stderr ?? '').trim()

// Guard: only write if the command exited 0 AND the output looks like real
// generated types (non-trivial length + the expected top-level export).
const looksValid = result.status === 0 && out.length > 500 && out.includes('export type Database')

if (!looksValid) {
  console.error('\n✗ Type generation failed — your existing database.types.ts was left untouched.\n')
  if (/unauthorized/i.test(err) || /unauthorized/i.test(out)) {
    console.error('  Cause: the Supabase CLI is not authenticated.')
    console.error('  Fix:   run `npx supabase login` (opens a browser), then re-run `npm run db:types`.')
    console.error('         Or set a SUPABASE_ACCESS_TOKEN env var.\n')
  } else if (err) {
    console.error('  CLI output:\n  ' + err.split('\n').join('\n  ') + '\n')
  } else {
    console.error('  No usable output was produced. Is the migration applied and the CLI authenticated?\n')
  }
  process.exit(1)
}

if (!existsSync(OUT)) {
  console.error(`✗ Target not found: ${OUT}`)
  process.exit(1)
}

writeFileSync(OUT, out)
console.log(`✓ Wrote ${OUT} (${out.length.toLocaleString()} bytes).`)
