import { defineConfig, devices } from '@playwright/test'

// Browser-verification harness for the goals spine. Deliberately .mjs so it stays
// out of `tsc --noEmit` and the prebuild gates — this drives a running dev server
// against the real Supabase project, it is not part of the build.
//
// Mobile is the source of truth here (see the project's device note), so Pixel 5
// is the only project: 393×851, Chrome-on-Android UA, touch enabled.
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.mjs/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    ...devices['Pixel 5'],
  },
})
