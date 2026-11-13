import AppZone from '@/components/app/AppZone'

// /goals is part of the Toolbox — the app canvas (components/app/AppZone.tsx).
export default function GoalsLayout({ children }: { children: React.ReactNode }) {
  return <AppZone>{children}</AppZone>
}
