import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'

export const dynamic = 'force-dynamic'

// Per-flavor display metadata for the Vault index. Reader-facing sections stay
// as Picks / Gifts / Comparisons / Stacks; this is the admin umbrella view.
const TYPE_META: Record<string, { label: string; chip: string }> = {
  general:    { label: 'Pick',       chip: 'bg-accent-tint text-accent-text border-accent-border/40' },
  best_of:    { label: 'Best Of',    chip: 'bg-amber-950/50 text-amber-300 border-amber-900/40' },
  gift_guide: { label: 'Gift Guide', chip: 'bg-rose-950/50 text-rose-300 border-rose-900/40' },
  comparison: { label: 'Comparison', chip: 'bg-sky-950/50 text-sky-300 border-sky-900/40' },
  stack:      { label: 'Stack',      chip: 'bg-emerald-950/50 text-emerald-300 border-emerald-900/40' },
}

export default async function PicksListPage() {
  await requireAdmin()

  const admin = createAdminClient()
  const { data: picks } = await admin
    .from('collections')
    .select('id, slug, title, description, is_visible, published_at, collection_type')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">The Vault</h1>
          <p className="text-prose-faint text-sm mt-1">
            Every curated collection — picks, gift guides, comparisons, and stacks. One form, five flavors.
          </p>
        </div>
        <Link
          href="/dashboard/admin/picks/new"
          className="shrink-0 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + New
        </Link>
      </div>

      {!picks?.length ? (
        <div className="bg-surface border border-soft rounded-2xl p-8 text-center">
          <p className="text-prose-muted mb-2">The Vault is empty.</p>
          <p className="text-xs text-prose-faint">
            Build your first collection — a Father&apos;s Day gift guide, a Yeti-vs-RTIC comparison, a Newborn Survival stack.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {(picks ?? []).map((p) => {
            const meta = TYPE_META[p.collection_type ?? 'general'] ?? TYPE_META.general
            return (
              <Link
                key={p.id}
                href={`/dashboard/admin/picks/${p.id}`}
                className="flex items-center justify-between gap-4 p-4 bg-surface hover:bg-surface-raised border border-soft rounded-2xl transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${meta.chip}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-prose-faint truncate">/{p.slug}</span>
                  </div>
                  <p className="font-semibold text-prose truncate">{p.title}</p>
                  {p.description && <p className="text-sm text-prose-faint truncate mt-0.5">{p.description}</p>}
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  p.is_visible
                    ? 'bg-green-50 text-forest'
                    : 'bg-surface-raised text-prose-faint'
                }`}>
                  {p.is_visible ? 'Live' : 'Draft'}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
