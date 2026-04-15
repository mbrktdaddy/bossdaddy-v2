import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug } from '@/lib/categories'

function RiskBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-gray-600 font-mono">—</span>

  const level = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low'
  const config = {
    high:   { label: 'High Risk',   bar: 'bg-red-500',    text: 'text-red-400',    bg: 'bg-red-950/40 border-red-900/60' },
    medium: { label: 'Review',      bar: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-950/40 border-yellow-900/60' },
    low:    { label: 'Low Risk',    bar: 'bg-green-500',  text: 'text-green-400',  bg: 'bg-green-950/40 border-green-900/60' },
  }[level]

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${config.bg}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${config.bar}`} />
      <span className={`text-xs font-semibold ${config.text}`}>{config.label}</span>
      <span className={`text-xs font-mono ${config.text} opacity-70`}>{score.toFixed(2)}</span>
    </div>
  )
}

export default async function ModerationQueuePage() {
  const supabase = await createClient()

  const { data: queue } = await supabase
    .from('reviews')
    .select('id, title, product_name, category, moderation_score, moderation_flags, created_at, profiles(username)')
    .eq('status', 'pending')
    .order('moderation_score', { ascending: false })

  const highRisk = queue?.filter(r => (r.moderation_score ?? 0) >= 0.7).length ?? 0
  const pending = queue?.length ?? 0

  return (
    <div className="p-8 max-w-5xl">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black">Moderation Queue</h1>
        <p className="text-gray-500 text-sm mt-1">Sorted by risk score — highest first</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
          <p className="text-2xl font-black text-white">{pending}</p>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Pending Review</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
          <p className="text-2xl font-black text-red-400">{highRisk}</p>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">High Risk</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
          <p className="text-2xl font-black text-yellow-400">{pending - highRisk}</p>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Needs Review</p>
        </div>
      </div>

      {!queue?.length ? (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-gray-400 font-semibold">Queue is clear.</p>
          <p className="text-gray-600 text-sm mt-1">Nice work, Boss.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((r) => {
            const score = r.moderation_score ? Number(r.moderation_score) : null
            const category = getCategoryBySlug(r.category)
            const author = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles as unknown as { username: string } | null)?.username ?? 'unknown'
            const flags = (r.moderation_flags as string[]) ?? []

            return (
              <Link
                key={r.id}
                href={`/dashboard/moderation/${r.id}`}
                className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-gray-700 transition-colors"
              >
                <div className="min-w-0 flex items-start gap-4">
                  {/* Risk indicator */}
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${
                    score === null ? 'bg-gray-700'
                    : score >= 0.7 ? 'bg-red-500'
                    : score >= 0.4 ? 'bg-yellow-500'
                    : 'bg-green-500'
                  }`} />

                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{r.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500">{r.product_name}</span>
                      <span className="text-xs text-gray-700">by @{author}</span>
                      {category && (
                        <span className={`text-xs ${category.accent}`}>{category.icon} {category.label}</span>
                      )}
                    </div>
                    {flags.length > 0 && (
                      <p className="text-xs text-red-400/70 mt-1 truncate">
                        ⚑ {flags.slice(0, 2).join(' · ')}{flags.length > 2 ? ` +${flags.length - 2} more` : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="ml-4 shrink-0 flex items-center gap-3">
                  <RiskBadge score={score} />
                  <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
