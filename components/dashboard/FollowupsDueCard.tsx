import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card } from '@/components/ui/Card'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { FRESHNESS_REASON_LABEL, type FreshnessReason } from '@/lib/content/freshness'

// Async Server Component — what the weekly freshness sweep flagged
// (content_freshness_flags, mig 167). Renders nothing when the table is empty.
// The actions live in the workspace (revisit plan, "verified", schedule a
// follow-up); this card only points there. Dashboard only, no email.

const TONE: Record<FreshnessReason, BadgeTone> = {
  'followup-due': 'accent',
  'product-unavailable': 'danger',
  'stale': 'warn',
}

type FlagRow = { content_type: string; content_id: string; reason: string; detail: string | null; flagged_at: string; last_seen_at: string }

export async function FollowupsDueCard() {
  const admin = createAdminClient()
  const { data: flags, error } = await admin
    .from('content_freshness_flags')
    .select('content_type, content_id, reason, detail, flagged_at, last_seen_at')
    .order('flagged_at', { ascending: true })
    .limit(60)

  if (error) { console.error('FollowupsDueCard: flags fetch failed', error); return null }
  if (!flags || flags.length === 0) return null

  const reviewIds = [...new Set(flags.filter((f) => f.content_type === 'review').map((f) => f.content_id))]
  const guideIds  = [...new Set(flags.filter((f) => f.content_type === 'guide').map((f) => f.content_id))]
  const [{ data: reviews }, { data: guides }] = await Promise.all([
    reviewIds.length ? admin.from('reviews').select('id, title').in('id', reviewIds) : Promise.resolve({ data: [] }),
    guideIds.length  ? admin.from('guides').select('id, title').in('id', guideIds)   : Promise.resolve({ data: [] }),
  ])
  const titles = new Map<string, string>()
  for (const r of reviews ?? []) titles.set(`review:${r.id}`, r.title)
  for (const g of guides ?? [])  titles.set(`guide:${g.id}`, g.title)

  // One row per piece; a piece can carry more than one reason.
  const items = new Map<string, { type: 'review' | 'guide'; id: string; title: string; flags: FlagRow[] }>()
  for (const f of flags as FlagRow[]) {
    const key = `${f.content_type}:${f.content_id}`
    const title = titles.get(key)
    if (!title) continue // orphan — the next sweep drops it
    const item = items.get(key) ?? { type: f.content_type as 'review' | 'guide', id: f.content_id, title, flags: [] }
    item.flags.push(f)
    items.set(key, item)
  }
  if (items.size === 0) return null

  const sweptAt = flags.reduce((max, f) => (f.last_seen_at > max ? f.last_seen_at : max), '')
  const swept = sweptAt ? new Date(sweptAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-soft flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-prose">Needs a look</p>
          <p className="text-xs text-prose-faint mt-0.5">
            Passed revisit plans, archived products, and pieces nobody has touched in a while.
          </p>
        </div>
        {swept && <p className="text-xs text-prose-faint whitespace-nowrap">Swept {swept}</p>}
      </div>
      <ul className="divide-y divide-soft">
        {[...items.values()].map((item) => {
          const href = `/dashboard/${item.type === 'review' ? 'reviews' : 'guides'}/${item.id}`
          return (
            <li key={`${item.type}:${item.id}`} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link href={href} className="block text-sm text-prose hover:text-accent truncate">
                  {item.title}
                </Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {item.flags.map((f) => (
                    <span key={f.reason} className="inline-flex items-center gap-1.5">
                      <Badge tone={TONE[f.reason as FreshnessReason] ?? 'neutral'} size="sm">
                        {FRESHNESS_REASON_LABEL[f.reason as FreshnessReason] ?? f.reason}
                      </Badge>
                      {f.detail && <span className="text-xs text-prose-faint">{f.detail}</span>}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href={href}
                className="shrink-0 text-xs font-semibold text-accent-text-soft hover:text-accent whitespace-nowrap"
              >
                Open →
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
