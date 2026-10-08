import Link from 'next/link'
import { getVaultTab, type VaultTabId } from '@/lib/vault'

interface Props {
  tab:     VaultTabId
  current: string
  className?: string
}

// Up-links name their destination ("Explore", "Stacks") — never "Back to".
// The root crumb is the listing's PARENT (Explore for reading formats, Gear for
// shopping formats) — the Vault hub that used to sit here is gone (Phase I-4).
export default function CollectionBreadcrumb({ tab: tabId, current, className = 'mb-8' }: Props) {
  const tab = getVaultTab(tabId)
  return (
    <nav aria-label="Breadcrumb" className={`text-xs text-prose-faint ${className}`}>
      <ol className="flex items-center gap-2 min-w-0">
        <li className="shrink-0">
          <Link href={tab.parent.href} className="inline-block py-2 hover:text-accent-text-soft transition-colors">{tab.parent.label}</Link>
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
