import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

// Dedicated config for the Boss concierge GOLDEN EVAL (`npm run boss:eval`).
// This harness makes REAL model calls, so it is deliberately kept OUT of the
// default `npm test` run: the default vitest.config.ts only includes
// `tests/**/*.test.ts`, and the eval lives in `tests/eval/*.ts` (no `.test.`),
// so CI never triggers a paid call. Run it by hand before/after a migration PR.
//
// loadEnv('', cwd, '') pulls EVERY key from .env / .env.local into process.env
// (empty prefix = no VITE_ filter) so the agent can reach the AI Gateway /
// Anthropic + Supabase exactly like the app does.
Object.assign(process.env, loadEnv('development', process.cwd(), ''))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/eval/**/*.ts'],
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
  resolve: {
    // Mirror tsconfig "@/*": ["./*"], scoped to `^@/` so it never shadows
    // scoped npm packages (matches vitest.config.ts).
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL('./', import.meta.url)) }],
  },
})
