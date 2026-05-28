// PWA web app manifest — Next.js App Router file convention.
//
// Why we have a PWA: dads who use the Savings tool tap "Yes" → the bank
// opens in a new tab → after the transfer they need to find Boss Daddy
// again. Installing as a PWA gives them a home-screen icon that lives in
// the app switcher, so coming back is one tap instead of digging through
// browser tabs.
//
// Icons reference the existing /icon.png (Next.js serves this from
// app/icon.png). Source is 1024x1024 — the browser scales to its needed
// install sizes. Future polish: pre-rendered 192/512 variants + a maskable
// version for Android adaptive icons.

import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:                 'Boss Daddy Life',
    short_name:           'Boss Daddy',
    description:          'Honest tools for real dads — savings habits, time-with-kids countdowns, college math.',
    start_url:            '/tools/savings',
    scope:                '/',
    display:              'standalone',
    orientation:          'portrait',
    background_color:     '#0a0a0a',
    theme_color:          '#CC5500',
    categories:           ['lifestyle', 'finance', 'productivity'],
    icons: [
      {
        src:     '/icon.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icon.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/apple-icon.png',
        sizes:   '180x180',
        type:    'image/png',
      },
    ],
  }
}
