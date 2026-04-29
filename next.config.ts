import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : 'fsxbertkzcigvkdyqgep.supabase.co'

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 768, 1024, 1152, 1280],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: supabaseHostname },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-* required by Next.js
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: https://images.unsplash.com https://m.media-amazon.com https://${supabaseHostname}`,
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://*.sentry.io https://*.ingest.sentry.io",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

// Only wrap with Sentry if a DSN is configured. Until you create your Sentry
// project and set NEXT_PUBLIC_SENTRY_DSN (and optionally SENTRY_AUTH_TOKEN
// for source map uploads), this is a no-op.
const sentryEnabled = !!process.env.NEXT_PUBLIC_SENTRY_DSN

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // Tunnel Sentry events through a same-origin route to bypass adblockers
      // that frequently block sentry.io requests directly.
      tunnelRoute: '/monitoring',

      silent: !process.env.CI,
      disableLogger: true,
    })
  : nextConfig
