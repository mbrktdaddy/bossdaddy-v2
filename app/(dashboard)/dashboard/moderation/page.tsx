import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function ModerationQueuePage() {
  const supabase = await createClient()

  const { data: queue } = await supabase
    .from('reviews')
    .select('id, title, product_name, author_id, moderation_score, moderation_flags, created_at, profiles(username)')
    .eq('status', 'pending')
    .order('moderation_score', { ascending: false }) // highest risk first

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Moderation Queue</h1>
      <p className="text-gray-500 text-sm mb-8">
        {queue?.length ?? 0} review{queue?.length !== 1 ? 's' : ''} pending · sorted by risk score
      </p>

      {!queue?.length ? (
        <div className="text-center py-20 text-gray-500">
          <p>Queue is clear. Nice work, Boss.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((r) => {
            const score = r.moderation_score ? Number(r.moderation_score) : null
            const scoreColor =
              score === null ? 'text-gray-500'
                : score >= 0.7 ? 'text-red-400'
                : score >= 0.4 ? 'text-yellow-400'
                : 'text-green-400'

            return (
              <Link
                key={r.id}
                href={`/dashboard/moderation/${r.id}`}
                className="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-800 hover:border-gray-600 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {r.product_name} ·{' '}
                    by @{(Array.isArray(r.profiles) ? r.profiles[0] : r.profiles as unknown as { username: string } | null)?.username ?? 'unknown'}
                  </p>
                  {r.moderation_flags && Array.isArray(r.moderation_flags) && r.moderation_flags.length > 0 && (
                    <p className="text-xs text-gray-600 mt-1 truncate">
                      Flags: {(r.moderation_flags as string[]).join(', ')}
                    </p>
                  )}
                </div>

                <div className="ml-4 shrink-0 text-right">
                  <p className={`text-lg font-bold font-mono ${scoreColor}`}>
                    {score !== null ? score.toFixed(2) : '—'}
                  </p>
                  <p className="text-xs text-gray-600">risk score</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
