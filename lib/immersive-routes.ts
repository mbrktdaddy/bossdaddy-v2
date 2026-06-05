// Routes that render as full-screen, app-like surfaces on mobile — the global
// mobile bottom nav is hidden and the page reclaims that space. Today this is
// the DM conversation view (composer pinned to the bottom; a nav strip beneath
// it reads as unfinished). The conversations LIST stays a normal page.
//
// Single source of truth so the bottom nav and the <main> bottom padding agree.
export function isImmersiveRoute(pathname: string): boolean {
  return /^\/account\/messages\/[^/]+/.test(pathname)
}
