import Link from 'next/link'
import { LABELS } from '@/lib/labels'
import { getVaultTab, type VaultTabId } from '@/lib/vault'

interface Props {
  tab:     Exclude<VaultTabId, 'all'>
  current: string
  className?: string
}

// Up-links name their destination ("The Vault", "Stacks") — never "Back to".
export default function VaultBreadcrumb({ tab: tabId, current, className = 'mb-8' }: Props) {
  const tab = getVaultTab(tabId)
  return (
    <nav aria-label="Breadcrumb" className={`text-xs text-prose-faint ${className}`}>
      <ol className="flex items-center gap-2 min-w-0">
        <li className="shrink-0">
          <Link href="/vault" className="inline-block py-2 hover:text-accent-text-soft transition-colors">{LABELS.vault.full}</Link>
        </li>
        <li aria-hidden className="shrink-0">/</li>
        <li className="shrink-0">
          <Link href={tab.href} className="inline-block py-2 hover:text-accent-text-soft transition-colors">{tab.label}</Link>
        </li>
        <li aria-hidden className="shrink-0">/</li>
        <li className="min-w-0 truncate text-prose-muted" aria-current="page">{current}</li>
      </ol>
    </nav>
  )
}
