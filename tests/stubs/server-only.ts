// Stub for the `server-only` import marker.
//
// `server-only` is not an installed package — Next.js resolves it internally to
// a module that throws if it ends up in a client bundle. Vitest has no such
// resolution, so importing any lib/ module that carries the marker fails with
// "Cannot find package 'server-only'".
//
// Aliased in vitest.config.ts. Keeping the marker in place matters: lib/goals/
// links.ts derives a signing key from the service-role key, so it must never be
// importable from a client component — the guardrail stays, the test runner just
// stops tripping over it.
export {}
