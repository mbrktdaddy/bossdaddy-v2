import { redirect } from 'next/navigation'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import NotificationFeed from '@/components/notifications/NotificationFeed'
import type { Metadata } from 'next'
import { BackLink } from '@/components/ui/BackLink'
import { LABELS } from '@/lib/labels'

export const metadata: Metadata = {
  title: LABELS.notifications.short,
  robots: { index: false, follow: false },
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect('/login?next=/account/notifications')

  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, payload, action_required, action_state, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Plain H1 for now, not PageHeader compact: that lockup needs an eyebrow, and
          under a "‹ Account" up-link the only honest one is "Account" again. The
          app-pages phase gives every /account page the lockup at once. */}
      <BackLink href="/account" label={LABELS.account.short} className="mb-4" />
      <h1 className="text-2xl sm:text-3xl font-black text-prose mb-6">{LABELS.notifications.short}</h1>
      <NotificationFeed initial={data ?? []} />
    </div>
  )
}
