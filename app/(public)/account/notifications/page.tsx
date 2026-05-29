import { redirect } from 'next/navigation'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import NotificationFeed from '@/components/notifications/NotificationFeed'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Notifications',
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
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-black text-prose mb-6">Notifications</h1>
      <NotificationFeed initial={data ?? []} />
    </div>
  )
}
