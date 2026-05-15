import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'

export const dynamic = 'force-dynamic'

export default async function PicksListPage() {
  await requireAdmin()

  const admin = createAdminClient()
  const { data: picks } = await admin
    .from('collections')
    .select('id, slug, title, description, is_visible, published_at')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Boss Daddy Picks</h1>
          <p className="text-gray-500 text-sm mt-1">Curated lists — gift guides, best-of collections, seasonal roundups.</p>
        </div>
        <Link
          href="/dashboard/admin/picks/new"
          className="shrink-0 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + New List
        </Link>
      </div>

      {!picks?.length ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400 mb-2">No pick lists yet.</p>
          <p className="text-xs text-gray-600">Create your first curated list — Father&apos;s Day picks, grilling must-haves, workshop essentials.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(picks ?? []).map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/admin/picks/${p.id}`}
              className="flex items-center justify-between gap-4 p-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl transition-colors"
            >
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{p.title}</p>
                {p.description && <p className="text-sm text-gray-500 truncate mt-0.5">{p.description}</p>}
              </div>
              <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                p.is_visible
                  ? 'bg-green-950/40 text-green-400'
                  : 'bg-gray-800 text-gray-500'
              }`}>
                {p.is_visible ? 'Live' : 'Draft'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
