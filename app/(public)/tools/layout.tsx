import AppZone from '@/components/app/AppZone'

// /tools is the Toolbox — the app canvas (components/app/AppZone.tsx).
export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return <AppZone>{children}</AppZone>
}
