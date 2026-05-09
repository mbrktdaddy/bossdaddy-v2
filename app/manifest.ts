import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Boss Daddy Life',
    short_name: 'Boss Daddy',
    description: 'The gold standard for men who Dad like a BOSS. Honest reviews, practical guides, real-dad wisdom.',
    start_url: '/',
    display: 'standalone',
    background_color: '#100c07',
    theme_color: '#100c07',
    icons: [
      {
        src: '/images/bd-logo-badge.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/images/bd-logo-badge.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
