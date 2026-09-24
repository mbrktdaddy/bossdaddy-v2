import { cache } from 'react'
import { createAnonClient } from '@/lib/supabase/anon'
import { getCollectionsWithCategory, type ListingCollection } from '@/lib/collection-listings'
import { OCCASIONS } from '@/lib/gift-occasions'
import { LABELS } from '@/lib/labels'

// ONE HUB, FIVE ADDRESSES. /vault is "All"; /comparisons, /picks, /stacks and
// /gifts are its tabs. Every one renders VaultShell (header + tab strip) so a
// reader always knows they're inside the Vault and can move sideways in one tap.
// The sub-routes stay real pages (they're what search indexes and what people
// have linked) — they are no longer separate designs of the same list.

export type VaultTabId = 'all' | 'comparisons' | 'picks' | 'stacks' | 'gifts'

export interface VaultTab {
  id:     VaultTabId
  href:   string
  label:  string
  /** H1. The hub is "The Vault"; each tab uses its one canonical name. */
  title:  string
  deck:   string
  types:  string[]
  /** Card footer CTA for this tab's own grid. */
  cardCta: string
}

export const ALL_COLLECTION_TYPES = ['comparison', 'best_of', 'general', 'stack', 'gift_guide']

export const VAULT_TABS: VaultTab[] = [
  {
    id: 'all', href: '/vault', label: 'All', title: LABELS.vault.full,
    deck: 'Every comparison, best-of list, stack, and gift guide in one place — built from gear I actually bought and tested.',
    types: ALL_COLLECTION_TYPES, cardCta: 'Open',
  },
  {
    id: 'comparisons', href: '/comparisons', label: LABELS.comparisons.short, title: LABELS.comparisons.short,
    deck: "When two or three products solve the same problem and you can't decide. Real testing, a scorecard, a winner per category, one clear bottom line.",
    types: ['comparison'], cardCta: 'See the scorecard',
  },
  {
    id: 'picks', href: '/picks', label: LABELS.picks.short, title: LABELS.picks.short,
    deck: 'Curated best-of lists from a dad who actually buys, tests, and lives with this stuff. Category roundups, ranked.',
    types: ['best_of', 'general'], cardCta: 'View the list',
  },
  {
    id: 'stacks', href: '/stacks', label: LABELS.stacks.short, title: LABELS.stacks.short,
    deck: 'The kit for the job. The newborn-night setup, the weekend cookout, the first-apartment toolbox. Each piece earned its spot.',
    types: ['stack'], cardCta: 'Build the stack',
  },
  {
    id: 'gifts', href: '/gifts', label: LABELS.gifts.short, title: LABELS.gifts.short,
    deck: 'Real-tested gift guides for every holiday, milestone, and budget. No corporate gift-list filler.',
    types: ['gift_guide'], cardCta: 'See the gifts',
  },
]

export function getVaultTab(id: VaultTabId): VaultTab {
  return VAULT_TABS.find((t) => t.id === id) ?? VAULT_TABS[0]
}

/** Card badge — the singular of the type's one canonical name. */
export function vaultTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case 'comparison': return LABELS.comparisons.singular
    case 'stack':      return LABELS.stacks.singular
    case 'gift_guide': return LABELS.gifts.singular
    case 'best_of':
    case 'general':    return LABELS.picks.singular
    default:           return 'Collection'
  }
}

/** Gift guides route by occasion so the URL survives yearly refreshes. */
export function vaultHref(col: { collection_type: string | null; slug: string; occasion?: string | null }): string {
  switch (col.collection_type) {
    case 'gift_guide': {
      const occ = col.occasion ? OCCASIONS.find((o) => o.value === col.occasion) : null
      return occ ? `/gifts/${occ.slug}` : '/gifts'
    }
    case 'comparison': return `/comparisons/${col.slug}`
    case 'stack':      return `/stacks/${col.slug}`
    default:           return `/picks/${col.slug}`
  }
}

/** Parent tab of a collection type — the up-link target for detail pages. */
export function vaultTabForType(type: string | null | undefined): VaultTab {
  return VAULT_TABS.find((t) => t.id !== 'all' && type != null && t.types.includes(type)) ?? VAULT_TABS[0]
}

// Deduped per request: VaultShell (tab counts) and the page body read the same rows.
// Cookie-free anon client keeps these pages statically renderable (audit H3).
export const getVaultCollections = cache(async (): Promise<ListingCollection[]> => {
  return getCollectionsWithCategory(createAnonClient(), ALL_COLLECTION_TYPES)
})
