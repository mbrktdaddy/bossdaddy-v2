import { cache } from 'react'
import { createAnonClient } from '@/lib/supabase/anon'
import { getCollectionsWithCategory, type ListingCollection } from '@/lib/collection-listings'
import { OCCASIONS } from '@/lib/gift-occasions'
import { LABELS } from '@/lib/labels'

// FOUR COLLECTION LISTINGS, TWO PARENTS. The Vault hub that used to sit over
// them is gone (nav-ia-plan Phase I-4, 2026-10-08): it grouped collections by
// database table, not by what the reader is doing. Comparisons and best-of
// lists are READING formats, so their parent is the Explore index; stacks and
// gift guides are SHOPPING formats, so their parent is Gear. The listing URLs
// are unchanged — they are what search has indexed and what people have linked.
//
// The file keeps its name: "The Vault" is the collections concept's FINAL name
// (operator, 2026-09-23) and still labels the admin side. Only the public hub
// stopped being a place.

export type VaultTabId = 'comparisons' | 'picks' | 'stacks' | 'gifts'

export interface VaultTab {
  id:     VaultTabId
  href:   string
  label:  string
  /** H1 — each listing uses its one canonical name. */
  title:  string
  /** PageHeader eyebrow — the listing's ROLE, never a repeat of the title. */
  eyebrow: string
  deck:   string
  types:  string[]
  /** Card footer CTA for this listing's own grid. */
  cardCta: string
  /** The listing's UP link (PageHeader `back` + the detail-page breadcrumb root). */
  parent: { href: string; label: string }
}

export const ALL_COLLECTION_TYPES = ['comparison', 'best_of', 'general', 'stack', 'gift_guide']

const EXPLORE_PARENT = { href: '/explore', label: LABELS.explore.short }
const GEAR_PARENT    = { href: '/gear',    label: LABELS.gear.short }

export const VAULT_TABS: VaultTab[] = [
  {
    id: 'comparisons', href: '/comparisons', label: LABELS.comparisons.short, title: LABELS.comparisons.short,
    eyebrow: 'Head to head',
    deck: "When two or three products solve the same problem and you can't decide. Real testing, a scorecard, a winner per category, one clear bottom line.",
    types: ['comparison'], cardCta: 'See the scorecard', parent: EXPLORE_PARENT,
  },
  {
    id: 'picks', href: '/picks', label: LABELS.picks.short, title: LABELS.picks.short,
    eyebrow: 'Ranked',
    deck: 'Curated best-of lists from a dad who actually buys, tests, and lives with this stuff. Category roundups, ranked.',
    types: ['best_of', 'general'], cardCta: 'View the list', parent: EXPLORE_PARENT,
  },
  {
    id: 'stacks', href: '/stacks', label: LABELS.stacks.short, title: LABELS.stacks.short,
    eyebrow: LABELS.stacks.kits,
    deck: 'The kit for the job. The newborn-night setup, the weekend cookout, the first-apartment toolbox. Each piece earned its spot.',
    types: ['stack'], cardCta: 'Build the stack', parent: GEAR_PARENT,
  },
  {
    id: 'gifts', href: '/gifts', label: LABELS.gifts.short, title: LABELS.gifts.short,
    eyebrow: 'By occasion',
    deck: 'Real-tested gift guides for every holiday, milestone, and budget. No corporate gift-list filler.',
    types: ['gift_guide'], cardCta: 'See the gifts', parent: GEAR_PARENT,
  },
]

// `general` folds into picks, so picks is the safe fallback for anything unknown.
export function getVaultTab(id: VaultTabId): VaultTab {
  return VAULT_TABS.find((t) => t.id === id) ?? VAULT_TABS[1]
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

/** Listing a collection type belongs to — the up-link target for detail pages. */
export function vaultTabForType(type: string | null | undefined): VaultTab {
  return VAULT_TABS.find((t) => type != null && t.types.includes(type)) ?? getVaultTab('picks')
}

// Deduped per request: the listings, the category hubs and /explore all read the
// same rows. Cookie-free anon client keeps these pages statically renderable
// (audit H3).
export const getVaultCollections = cache(async (): Promise<ListingCollection[]> => {
  return getCollectionsWithCategory(createAnonClient(), ALL_COLLECTION_TYPES)
})
