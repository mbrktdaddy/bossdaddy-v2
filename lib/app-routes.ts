// The Toolbox's routes — the app canvas (brand-guide §11 "The Toolbox scheme";
// components/app/AppZone.tsx). One mode per route: these pages open with the
// program, not the Magazine's topic nav, so the topics row under the masthead
// hides here (components/HideOnApp.tsx). The masthead and the footer stay.
// Keep this list in step with the four `layout.tsx` files that mount AppZone.
export function isAppRoute(pathname: string): boolean {
  return /^\/(tools|goals|today|account)(\/|$)/.test(pathname)
}
