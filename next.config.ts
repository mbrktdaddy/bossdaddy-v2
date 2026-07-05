import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

// Font + logo files the Merch Studio render core reads from disk at runtime.
const merchRenderAssets = [
  './lib/merch/fonts/*.ttf',
  './lib/merch/assets/*.png',
  './public/images/bd-logo-icon.png', // fallback logo
]

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : 'fsxbertkzcigvkdyqgep.supabase.co'

const nextConfig: NextConfig = {
  // Allow LAN device origins (phone on local network) to use the dev server's
  // HMR endpoint. Dev-only — production builds ignore this.
  allowedDevOrigins: ['192.168.1.104'],

  // The Merch Studio render route reads brand font files + the logo from disk at
  // runtime (Satori needs raw TTFs). Vercel's file tracer won't detect the
  // fs.readFile paths, so include them explicitly in that function's bundle.
  outputFileTracingIncludes: {
    // Both routes render via lib/merch/render.ts, which reads these font/logo
    // files from disk at runtime — Vercel's tracer can't detect the paths, so
    // include them explicitly for every function that renders.
    '/api/merch/render': merchRenderAssets,
    '/api/merch/publish': merchRenderAssets,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    deviceSizes: [480, 640, 768, 1024, 1152, 1280],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: supabaseHostname },
      { protocol: 'https', hostname: 'files.cdn.printful.com' },
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com", // unsafe-* required by Next.js; vercel-scripts for Analytics + Speed Insights
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: https://images.unsplash.com https://m.media-amazon.com https://${supabaseHostname} https://files.cdn.printful.com`,
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://*.sentry.io https://*.ingest.sentry.io https://vitals.vercel-insights.com",
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

const wrapped = sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // Tunnel Sentry events through a same-origin route to bypass adblockers
      // that frequently block sentry.io requests directly.
      tunnelRoute: '/monitoring',

      silent: !process.env.CI,
    })
  : nextConfig

export default withBundleAnalyzer(wrapped)
