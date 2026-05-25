import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import { MERCH_CATEGORIES, MERCH_STATUSES, formatPrice, getMerchDisplayImage, type Merch } from '@/lib/merch'

export const dynamic = 'force-dynamic'

export default async function AdminMerchListPage() {
  await requireAdmin()

  const admin = createAdminClient()
  const { data } = await admin
    .from('merch')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as Merch[]

  const visibleCount = rows.filter((r) => MERCH_STATUSES.find((s) => s.value === r.status)?.publiclyVisible).length

  return (
    <div className="p-8 max-w-5xl">

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Merch</h1>
          <p className="text-prose-faint text-sm mt-1">
            Boss Daddy branded merch. {rows.length} item{rows.length === 1 ? '' : 's'} total · {visibleCount} publicly visible.
          </p>
        </div>
        <Link
          href="/dashboard/admin/merch/new"
          className="shrink-0 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + New item
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-surface border border-soft rounded-xl p-8 text-center">
          <p className="text-prose-muted mb-2">No merch items yet.</p>
          <p className="text-xs text-prose-faint">
            Add your first item — set status to <code className="text-accent-text-soft">coming_soon</code> to show it on /gear with a &quot;Notify me&quot; CTA.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => {
            const cat = MERCH_CATEGORIES.find((c) => c.slug === p.category)
            const stat = MERCH_STATUSES.find((s) => s.value === p.status)
            return (
              <Link
                key={p.id}
                href={`/dashboard/admin/merch/${p.id}`}
                className="flex items-center gap-4 p-4 bg-surface hover:bg-surface-raised border border-soft rounded-xl transition-colors"
              >
                {/* Thumbnail */}
                <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-surface-sunken border border-soft">
                  {getMerchDisplayImage(p) ? (
                    <Image src={getMerchDisplayImage(p)!} alt={p.name} fill className="object-cover" sizes="56px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    {p.featured && (
                      <span className="text-xs text-accent-text-soft font-bold">★ Featured</span>
                    )}
                    {cat && (
                      <span className="text-xs text-prose-faint">
                        {cat.icon} {cat.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-prose-faint mt-0.5">
                    <code className="text-accent-text-soft">{p.slug}</code>
                    <span className="ml-3">{formatPrice(p.price_cents) || 'no price'}</span>
                    <span className="ml-3 text-prose-faint">pos {p.position}</span>
                  </p>
                </div>

                <div className="shrink-0">
                  <span
                    className={`px-2 py-1 text-xs rounded-md border ${
                      p.status === 'available'   ? 'bg-green-50 text-forest border-green-300'  :
                      p.status === 'coming_soon' ? 'bg-accent-tint text-accent-text-soft border-accent-border/40' :
                      p.status === 'concept'     ? 'bg-surface-raised text-prose-muted border-strong' :
                      'bg-red-50 text-red-700 border-red-300'
                    }`}
                  >
                    {stat?.label ?? p.status}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
