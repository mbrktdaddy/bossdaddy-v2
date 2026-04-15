import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-gray-800">
          <Link href="/" className="text-orange-500 font-bold text-lg">
            Boss Daddy
          </Link>
          <p className="text-gray-500 text-xs mt-0.5">@{profile?.username}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/dashboard/reviews"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            My Reviews
          </Link>
          <Link
            href="/dashboard/reviews/new"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            + New Review
          </Link>
          {isAdmin && (
            <Link
              href="/dashboard/moderation"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              Moderation Queue
            </Link>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-gray-800">
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
