import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import { getCategoryLabel } from '@/lib/categories'

export const dynamic = 'force-dynamic'

// Gear demand: every gap query that sent The Boss to live research (no tested
// pick existed). Aggregated by query, this is the editorial roadmap signal —
// what members keep asking for that we don't yet cover, ranked by demand.

type RequestRow = {
  id: string
  query: string
  category: string | null
  fit: string | null
  results_count: number
  created_at: string
}

type Agg = {
  key: string
  query: string
  category: string | null
  count: number
  lastAt: string
  zeroResults: number
}

function fmtDate(iso: string): string {
  // Stable, locale-free YYYY-MM-DD (no Date.now / new Date() needed).
  return iso.slice(0, 10)
}

export default async function DemandAdminPage() {
  await requireAdmin()

  const admin = createAdminClient()
  const { data } = await admin
    .from('boss_research_requests')
    .select('id, query, category, fit, results_count, created_at')
    .order('created_at', { ascending: false })
    .limit(1000)

  const rows = (data ?? []) as RequestRow[]

  // Aggregate by normalized query (lowercase, collapsed whitespace).
  const byKey = new Map<string, Agg>()
  for (const r of rows) {
    const key = r.query.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!key) continue
    const existing = byKey.get(key)
    if (existing) {
      existing.count += 1
      if (r.results_count === 0) existing.zeroResults += 1
      if (r.created_at > existing.lastAt) existing.lastAt = r.created_at
    } else {
      byKey.set(key, {
        key,
        query: r.query.trim(),
        category: r.category,
        count: 1,
        lastAt: r.created_at,
        zeroResults: r.results_count === 0 ? 1 : 0,
      })
    }
  }
  const ranked = [...byKey.values()].sort(
    (a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt),
  )

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Gear Demand</h1>
          <p className="text-prose-faint text-sm mt-1 leading-relaxed">
            What members ask The Boss for when we have no tested pick. Ranked by
            demand — your roadmap for what to test next.{' '}
            <Link href="/dashboard/admin/candidates" className="text-accent-text-soft hover:text-accent">
              See researched candidates →
            </Link>
          </p>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="bg-surface border border-soft rounded-xl p-8 text-center">
          <p className="text-prose-muted mb-1">No demand logged yet.</p>
          <p className="text-xs text-prose-faint">
            When a member asks for gear we haven&apos;t tested, the request lands here.
          </p>
        </div>
      ) : (
        <>
          {/* Most requested */}
          <section className="mb-10">
            <h2 className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">
              Most requested ({ranked.length} distinct)
            </h2>
            <div className="space-y-2">
              {ranked.map((a) => (
                <div
                  key={a.key}
                  className="flex items-center gap-4 p-4 bg-surface border border-soft rounded-xl"
                >
                  <div className="shrink-0 w-10 text-center">
                    <span className="text-lg font-black tabular-nums text-accent-text-soft">{a.count}</span>
                    <span className="block text-[10px] text-prose-faint uppercase tracking-wide">asked</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-prose truncate">{a.query}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-prose-faint flex-wrap">
                      {a.category && <span>{getCategoryLabel(a.category)}</span>}
                      <span>· last {fmtDate(a.lastAt)}</span>
                      {a.zeroResults > 0 && (
                        <span className="text-rose-700">· {a.zeroResults}× no results</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent raw requests */}
          <section>
            <h2 className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">
              Recent requests
            </h2>
            <div className="space-y-1">
              {rows.slice(0, 50).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-4 py-2.5 bg-surface-raised/40 border border-soft rounded-lg text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-prose-muted">{r.query}</span>
                  {r.results_count === 0 ? (
                    <span className="shrink-0 text-xs text-rose-700">no results</span>
                  ) : (
                    <span className="shrink-0 text-xs text-prose-faint">{r.results_count} found</span>
                  )}
                  <span className="shrink-0 text-xs text-prose-faint tabular-nums">{fmtDate(r.created_at)}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
