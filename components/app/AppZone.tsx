// The app zone — the Toolbox's canvas (2026-11-13, brand-guide §11 "The
// Toolbox scheme"). Two products on one brand: the Magazine is the light
// editorial canvas (Hard Goods, §10.1); the Toolbox — /tools, /goals, /today,
// /account — is a dark app canvas, the same zone mechanism the (dashboard)
// layout uses. `data-theme="dark"` rotates every role token; `data-zone="app"`
// is what the `app:` Tailwind variant (app/globals.css) keys on, so the shared
// primitives that assume a white page — chrome label blocks, 2px chrome edges,
// black panels — take their raised-panel forms here without forking components.
// The masthead, bottom nav and footer are already chrome, so an app page is one
// continuous dark viewport. Signed-out visitors see the app in its demo state:
// one mode per route, no surprises.
export default function AppZone({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="dark" data-zone="app" className="bg-background text-prose">
      {children}
    </div>
  )
}
