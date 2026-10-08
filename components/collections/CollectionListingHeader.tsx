import PageHeader from '@/components/PageHeader'
import { getVaultTab, type VaultTabId } from '@/lib/vault'

/**
 * The header every collection listing shares: an up-link to the listing's
 * parent (Explore or Gear), the role eyebrow, the canonical H1 and deck — all
 * read from one `VAULT_TABS` entry so the four pages can't drift. Replaces the
 * Vault shell's tab strip (Phase I-4): no sideways tabs, no zero counts.
 */
export default function CollectionListingHeader({ tab: tabId }: { tab: VaultTabId }) {
  const tab = getVaultTab(tabId)
  return <PageHeader back={tab.parent} eyebrow={tab.eyebrow} title={tab.title} deck={tab.deck} />
}
