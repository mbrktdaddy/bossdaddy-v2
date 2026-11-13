import AppZone from '@/components/app/AppZone'

// /account is app chrome — part of the Toolbox canvas (components/app/AppZone.tsx).
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AppZone>{children}</AppZone>
}
