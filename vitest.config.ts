import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// First test harness for the project (audit C2). Node environment — every
// suite here exercises server-side lib/ logic and route handlers, not the DOM.
// Path alias mirrors tsconfig's "@/*": ["./*"]. Scoped to `^@/` so it never
// shadows scoped npm packages like @anthropic-ai/sdk or @supabase/ssr.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: [
      { find: /^@\//, replacement: fileURLToPath(new URL('./', import.meta.url)) },
      // `server-only` is resolved internally by Next, not installed as a
      // package, so anything carrying the marker is unimportable here without
      // this stub. See tests/stubs/server-only.ts.
      { find: 'server-only', replacement: fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)) },
    ],
  },
})
