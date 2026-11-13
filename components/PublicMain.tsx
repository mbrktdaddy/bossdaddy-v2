// <main> wrapper — keeps the #main-content skip-link target. Children are
// server-rendered and passed straight through.
//
// The mobile bottom-nav clearance used to live here as `pb-14 md:pb-0`. It moved
// to the Footer on 2026-11-13: on main it was a 56px band of PAGE background
// between the last section and the dark footer — invisible on the white page,
// a light void on the Toolbox's dark canvas — and it protected nothing, because
// the fixed nav covers the bottom of the FOOTER, not the bottom of main. The
// footer is dark and hides on the same immersive routes as the nav, so the
// clearance belongs to it.
export default function PublicMain({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="flex-1 w-full overflow-x-clip">
      {children}
    </main>
  )
}
