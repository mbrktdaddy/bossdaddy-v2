import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import type { Product } from '@/lib/products'
import { PRODUCT_STATUS_OPTIONS } from '@/lib/products'

export const dynamic = 'force-dynamic'

// One unified admin for the products spine. The "bench" is just products in
// their early lifecycle states, so a status filter is all we need to manage both
// the catalog and the testing pipeline from one place.
const TABS: { key: string; label: string; statuses: string[] | null; active: string; idle: string }[] = [
  { key: 'all',      label: 'All',      statuses: null,                                  active: 'bg-accent text-white',     idle: 'bg-surface-raised text-prose-muted hover:text-prose' },
  { key: 'bench',    label: 'Bench',    statuses: ['considering', 'queued', 'testing'],  active: 'bg-blue-600 text-white',   idle: 'bg-surface-raised text-blue-700 hover:text-blue-600' },
  { key: 'reviewed', label: 'Reviewed', statuses: ['reviewed'],                          active: 'bg-green-600 text-white',  idle: 'bg-surface-raised text-green-700 hover:text-green-600' },
  { key: 'passed',   label: 'Passed',   statuses: ['passed'],                            active: 'bg-zinc-600 text-white',   idle: 'bg-surface-raised text-zinc-500 hover:text-zinc-400' },
  { key: 'archived', label: 'Archived', statuses: ['archived'],                          active: 'bg-rose-700 text-white',   idle: 'bg-surface-raised text-rose-700 hover:text-rose-600' },
]

const STATUS_LABEL = new Map(PRODUCT_STATUS_OPTIONS.map((s) => [s.value, s.label]))

// Per-status badge accents (colored border + text on the neutral surface — no
// pale fills, per the design guardrails).
const STATUS_BADGE: Record<string, string> = {
  considering: 'text-blue-700 border-blue-400/50',
  queued:      'text-indigo-700 border-indigo-400/50',
  testing:     'text-amber-700 border-amber-400/50',
  reviewed:    'text-green-700 border-green-400/50',
  passed:      'text-zinc-500 border-zinc-400/50',
  archived:    'text-rose-700 border-rose-400/50',
}

type Row = Product & { vote_count?: { count: number }[] }

export default async function ProductsListPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireAdmin()
  const { tab } = await searchParams
  const active = TABS.find((t) => t.key === tab) ?? TABS[0]

  const admin = createAdminClient()
  let query = admin
    .from('products')
    .select('*, vote_count:wishlist_votes(count)')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
  if (active.statuses) query = query.in('status', active.statuses)

  const { data } = await query
  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({
    ...r,
    votes: r.vote_count?.[0]?.count ?? 0,
  }))

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Products</h1>
          <p className="text-prose-faint text-sm mt-1">
            The full gear catalog and testing bench — one spine. Referenced by{' '}
            <code className="text-accent-text-soft">[[BUY:slug]]</code> tokens in reviews.
          </p>
        </div>
        <Link
          href="/dashboard/admin/products/new"
          className="shrink-0 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + New product
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === 'all' ? '/dashboard/admin/products' : `/dashboard/admin/products?tab=${t.key}`}
            className={`shrink-0 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              t.key === active.key ? t.active : t.idle
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="bg-surface border border-soft rounded-xl p-8 text-center">
          <p className="text-prose-muted mb-2">No products in this view.</p>
          <p className="text-xs text-prose-faint">
            Create one, or adopt a{' '}
            <Link href="/dashboard/admin/candidates" className="text-accent-text-soft hover:text-accent">researched candidate</Link>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/admin/products/${p.id}`}
              className="flex items-center gap-4 p-4 bg-surface hover:bg-surface-raised border border-soft rounded-xl transition-colors"
            >
              <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-surface-sunken border border-soft">
                {p.image_url ? (
                  <Image src={p.image_url} alt={p.name} fill className="object-contain p-1" sizes="48px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{p.name}</p>
                <p className="text-xs text-prose-faint mt-0.5">
                  <code className="text-accent-text-soft">[[BUY:{p.slug}]]</code>
                  {p.votes > 0 ? <span className="ml-3">{p.votes} {p.votes === 1 ? 'vote' : 'votes'}</span> : null}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2 text-xs">
                <span className={`px-2 py-1 rounded-md bg-surface-raised border font-medium ${STATUS_BADGE[p.status] ?? 'text-prose-muted border-strong'}`}>
                  {STATUS_LABEL.get(p.status) ?? p.status}
                </span>
                {!p.affiliate_url && !p.non_affiliate_url ? (
                  <span className="px-2 py-1 rounded-md bg-danger-bg text-danger-ink border border-danger-line">No URL</span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
