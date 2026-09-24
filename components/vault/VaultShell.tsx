import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { LABELS } from '@/lib/labels'
import { VAULT_TABS, getVaultTab, getVaultCollections, type VaultTabId } from '@/lib/vault'

interface Props {
  active:   VaultTabId
  children: React.ReactNode
}

// The chrome every Vault address shares. The eyebrow names the hub on the tabs
// ("The Vault") so a reader who lands on /stacks from search still sees which
// section they're in; on the hub itself the H1 already says it.
export default async function VaultShell({ active, children }: Props) {
  const tab = getVaultTab(active)
  const all = await getVaultCollections()
  const counts = new Map(VAULT_TABS.map((t) => [t.id, all.filter((c) => t.types.includes(c.collection_type)).length]))

  return (
    <>
      <PageHeader
        eyebrow={active === 'all' ? 'Collections built from tested gear' : LABELS.vault.full}
        title={tab.title}
        deck={tab.deck}
      />
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-12">
        <nav aria-label={`${LABELS.vault.full} sections`} className="mb-8 -mx-6 px-6 border-b border-soft">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {VAULT_TABS.map((t) => {
              const isActive = t.id === active
              return (
                <Link
                  key={t.id}
                  href={t.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`shrink-0 inline-flex items-center gap-2 px-3 py-3 -mb-px border-b-2 text-sm font-semibold transition-colors min-h-[44px] ${
                    isActive
                      ? 'border-accent text-prose'
                      : 'border-transparent text-prose-muted hover:text-prose hover:border-strong'
                  }`}
                >
                  {t.label}
                  <span className="text-[11px] font-bold tabular-nums text-prose-faint">{counts.get(t.id) ?? 0}</span>
                </Link>
              )
            })}
          </div>
        </nav>
        {children}
      </div>
    </>
  )
}
