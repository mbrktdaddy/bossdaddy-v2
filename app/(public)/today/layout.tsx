import AppZone from '@/components/app/AppZone'

// /today is part of the Toolbox — the app canvas (components/app/AppZone.tsx).
export default function TodayLayout({ children }: { children: React.ReactNode }) {
  return <AppZone>{children}</AppZone>
}
