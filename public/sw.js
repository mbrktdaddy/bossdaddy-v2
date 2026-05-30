// Minimal service worker for PWA installability. Chrome requires a service
// worker registered to consider the site installable; iOS doesn't strictly
// need one, but having it doesn't hurt.
//
// Strategy: passthrough — every fetch goes to the network. We're not
// caching anything here because (a) Next.js already aggressively caches
// static assets via the platform, and (b) caching dynamic data (Supabase
// reads) would create staleness bugs that would surprise users on a
// commitment-tracking app.
//
// If we want true offline support later (cache the goal-page shell so
// installed users can see their data without a connection), add a cache
// + match strategy here. For Phase 4 we just need installability.

self.addEventListener('install', () => {
  // Skip waiting so updates activate immediately on next page load.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Claim clients so the SW controls all open tabs after the first install.
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // No-op. Network passthrough.
})

// ── Web Push (Phase 2) ──────────────────────────────────────────────────────
// Show a notification when the server pushes one. Payload shape comes from
// lib/push.ts PushPayload: { title, body?, url?, tag? }. Privacy-first — the
// server sends sender name only, never message content.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || 'Boss Daddy'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Focus an existing tab if one is open, otherwise open a new one at the target.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
