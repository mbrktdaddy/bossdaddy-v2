import Link from 'next/link'
import CategoryFilterPills from '@/components/collections/CategoryFilterPills'
import VaultCard from '@/components/VaultCard'
import { getVaultTab, getVaultCollections, type VaultTabId } from '@/lib/vault'

interface Props {
  tab: VaultTabId
  /** Active ?cat= filter, if any. */
  cat: string | null
}

export default async function VaultGrid({ tab: tabId, cat }: Props) {
  const tab = getVaultTab(tabId)
  const all = (await getVaultCollections()).filter((c) => tab.types.includes(c.collection_type))

  // Counts come from the unfiltered tab so the pills don't shrink as you filter.
  const counts = new Map<string, number>()
  for (const c of all) {
    if (c.dominant_category) counts.set(c.dominant_category, (counts.get(c.dominant_category) ?? 0) + 1)
  }
  const filtered = cat ? all.filter((c) => c.dominant_category === cat) : all

  return (
    <>
      <CategoryFilterPills basePath={tab.href} active={cat} counts={counts} total={all.length} />

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface/40 border border-dashed border-soft rounded-xl">
          <p className="text-prose-faint text-lg font-semibold">
            {cat ? 'Nothing in this category yet.' : 'First one drops soon.'}
          </p>
          {cat && (
            <Link href={tab.href} className="inline-block mt-2 py-2 text-sm text-accent-text-soft hover:text-accent font-semibold">
              Clear the filter →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Index 0 only gets priority: it's the LCP candidate on a one-column phone grid. */}
          {filtered.map((c, i) => (
            <VaultCard key={c.id} col={c} priority={i === 0} cta={tab.id === 'all' ? undefined : tab.cardCta} />
          ))}
        </div>
      )}
    </>
  )
}
