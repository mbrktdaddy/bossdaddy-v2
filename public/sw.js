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
