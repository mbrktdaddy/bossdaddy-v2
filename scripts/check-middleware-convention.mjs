#!/usr/bin/env node
// Guard script: enforces the Next.js 16 middleware-file convention.
//
// Next.js 16 renamed the middleware file from middleware.ts to proxy.ts.
// This codebase has been bitten 4+ times by sessions/agents renaming
// proxy.ts → middleware.ts (the wrong direction), which silently breaks
// auth protection, session refresh, and redirects.
//
// This script runs before every `next build` (via the prebuild npm hook)
// and as part of the pre-commit hook, so the bad rename is caught before
// it ever ships.

import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const middlewarePath = resolve(root, 'middleware.ts')
const proxyPath      = resolve(root, 'proxy.ts')

const middlewareExists = existsSync(middlewarePath)
const proxyExists      = existsSync(proxyPath)

const RED   = '\x1b[31m'
const BOLD  = '\x1b[1m'
const RESET = '\x1b[0m'

function fail(msg) {
  console.error(`${RED}${BOLD}\n✗ Middleware convention check failed${RESET}\n`)
  console.error(msg)
  console.error('\nSee CLAUDE.md → "Middleware — NEVER Rename proxy.ts" for full context.\n')
  process.exit(1)
}

if (middlewareExists) {
  fail(
    `Found middleware.ts at the project root.\n\n` +
    `Next.js 16 uses proxy.ts, NOT middleware.ts. Having both files (or only middleware.ts)\n` +
    `causes a hard build failure with the message:\n` +
    `  "Both middleware file './middleware.ts' and proxy file './proxy.ts' are detected."\n\n` +
    `Fix: delete middleware.ts. The middleware logic lives in proxy.ts.\n`
  )
}

if (!proxyExists) {
  fail(
    `proxy.ts is missing from the project root.\n\n` +
    `Next.js 16 requires proxy.ts as the middleware entry point. Without it,\n` +
    `auth protection on /dashboard, Supabase session refresh, and legacy URL\n` +
    `redirects all stop running silently (no build error, just broken behavior).\n\n` +
    `Fix: restore proxy.ts. Do NOT recreate it as middleware.ts.\n`
  )
}

// All good
process.exit(0)
