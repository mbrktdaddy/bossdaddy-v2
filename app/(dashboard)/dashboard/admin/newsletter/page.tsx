import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NewsletterDigestTrigger } from './_components/NewsletterDigestTrigger'

export const dynamic = 'force-dynamic'

interface Subscriber {
  email: string
  confirmed: boolean
  interests: string[] | null
  created_at: string
}

export default async function AdminNewsletterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') notFound()

  const admin = createAdminClient()
  const { data, count } = await admin
    .from('newsletter_subscribers')
    .select('email, confirmed, interests, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(50)

  const subs = (data ?? []) as Subscriber[]
  const total = count ?? 0
  const confirmed = subs.filter((s) => s.confirmed).length

  // Aggregate interest counts (across visible 50 — fine as a quick signal,
  // not the source of truth for total list)
  const interestCounts: Record<string, number> = {}
  for (const s of subs) {
    for (const t of s.interests ?? []) {
      interestCounts[t] = (interestCounts[t] ?? 0) + 1
    }
  }
  const interestRows = Object.entries(interestCounts).sort((a, b) => b[1] - a[1])

  return (
    <div className="p-8 max-w-5xl">

      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">Newsletter</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total.toLocaleString()} subscriber{total === 1 ? '' : 's'} · weekly digest sends Tuesday at 14:00 UTC.
          </p>
        </div>
        <NewsletterDigestTrigger />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Stat label="Total"           value={total.toLocaleString()} />
        <Stat label="Confirmed"       value={confirmed.toLocaleString()} />
        <Stat label="Newsletter"      value={(interestCounts['newsletter']    ?? 0).toLocaleString()} />
        <Stat label="Shop launch"     value={(interestCounts['shop_launch']   ?? 0).toLocaleString()} />
      </div>

      {/* Interests breakdown (recent 50) */}
      {interestRows.length > 0 && (
        <div className="mb-8 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">
            Interest tags (most recent 50)
          </p>
          <div className="flex flex-wrap gap-2">
            {interestRows.map(([tag, n]) => (
              <span key={tag} className="px-3 py-1.5 bg-gray-950 border border-gray-700 rounded-full text-xs">
                <span className="text-gray-400">{tag}</span>
                <span className="ml-2 text-orange-400 font-semibold">{n}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent subscribers */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <p className="text-sm font-semibold">Recent signups</p>
          <p className="text-xs text-gray-600">Showing latest 50</p>
        </div>
        {subs.length === 0 ? (
          <p className="px-5 py-12 text-center text-gray-500 text-sm">
            No subscribers yet.
          </p>
        ) : (
          <div className="divide-y divide-gray-800">
            {subs.map((s) => (
              <div key={s.email} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-200 truncate">{s.email}</p>
                  {(s.interests ?? []).length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {s.interests!.map((t) => (
                        <span key={t} className="text-[10px] text-orange-400 bg-orange-950/30 px-1.5 py-0.5 rounded border border-orange-900/30">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-600 shrink-0 text-right">
                  <p>{new Date(s.created_at).toLocaleDateString()}</p>
                  {!s.confirmed && (
                    <p className="text-yellow-500 mt-0.5">unconfirmed</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  )
}
