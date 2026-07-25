import { CATEGORIES, type CategorySlug } from './categories'

export type TagGroup = 'life-stage' | 'price' | 'use-case' | 'editorial' | 'topic' | 'audience'

export interface Tag {
  slug: string
  label: string
  tag_group: TagGroup
  display_order: number
  // Hierarchy (migration 127). Present on rows selected from `tags`; optional so
  // code that constructs a Tag without them still type-checks.
  //   topic + parent_slug null   -> Tier-2 subject group (category_slug = pillar)
  //   topic + parent_slug set    -> Tier-3 leaf under that group
  //   topic + category_slug null -> cross-cutting subject (no single pillar, e.g. faith)
  parent_slug?: string | null
  category_slug?: string | null
}

export const TAG_GROUP_LABELS: Record<TagGroup, string> = {
  'life-stage': 'Life Stage',
  'price':      'Price',
  'use-case':   'Use Case',
  'editorial':  'Editorial',
  'topic':      'Topic',
  'audience':   'Audience',
}

export const TAG_GROUP_ORDER: TagGroup[] = [
  'editorial', 'life-stage', 'price', 'use-case', 'audience', 'topic',
]

// Client-side: fetch all tags grouped by tag_group
export async function fetchTagsGrouped(): Promise<Record<TagGroup, Tag[]>> {
  const res = await fetch('/api/tags')
  if (!res.ok) return {} as Record<TagGroup, Tag[]>
  const { tags } = await res.json()
  const grouped: Partial<Record<TagGroup, Tag[]>> = {}
  for (const tag of tags as Tag[]) {
    if (!grouped[tag.tag_group]) grouped[tag.tag_group] = []
    grouped[tag.tag_group]!.push(tag)
  }
  return grouped as Record<TagGroup, Tag[]>
}

// ─────────────────────────────────────────────────────────────────────────────
// Pillar -> subject -> leaf tree. See docs/pillar-taxonomy.md §8.
// Pillars live in lib/categories.ts, NOT the tags table; a subject tag points at
// its pillar via `category_slug`.
// ─────────────────────────────────────────────────────────────────────────────

export const SUBJECT_TAG_GROUP: TagGroup = 'topic'

export interface SubjectNode extends Tag {
  /** Tier-3 leaves nested under this Tier-2 subject group. */
  children: Tag[]
}

export interface PillarTags {
  slug: CategorySlug
  label: string
  subjects: SubjectNode[]
}

export interface TagTree {
  /** One entry per pillar (lib/categories.ts order), each with its subject groups + leaves. */
  pillars: PillarTags[]
  /** Subject tags with no pillar (category_slug null) — e.g. faith, storage-org, smart-home. */
  crossCutting: SubjectNode[]
  /** Non-subject facets, keyed by tag_group (life-stage, price, use-case, editorial, audience). */
  facets: Partial<Record<TagGroup, Tag[]>>
}

function byOrder(a: Tag, b: Tag): number {
  if (a.display_order !== b.display_order) return a.display_order - b.display_order
  return a.label.localeCompare(b.label)
}

/**
 * Build the pillar -> subject -> leaf tree (plus cross-cutting subjects and facets)
 * from a flat list of tag rows. Pure — pass the rows you fetched from `tags`.
 */
export function buildTagTree(tags: Tag[]): TagTree {
  const subjects = tags.filter((t) => t.tag_group === SUBJECT_TAG_GROUP)
  const groups = subjects.filter((t) => (t.parent_slug ?? null) === null)
  const leaves = subjects.filter((t) => (t.parent_slug ?? null) !== null)

  const leavesByParent = new Map<string, Tag[]>()
  for (const leaf of leaves) {
    const key = leaf.parent_slug as string
    const list = leavesByParent.get(key) ?? []
    list.push(leaf)
    leavesByParent.set(key, list)
  }

  const toNode = (group: Tag): SubjectNode => ({
    ...group,
    children: [...(leavesByParent.get(group.slug) ?? [])].sort(byOrder),
  })

  const pillars: PillarTags[] = CATEGORIES.map((cat) => ({
    slug: cat.slug,
    label: cat.label,
    subjects: groups
      .filter((g) => g.category_slug === cat.slug)
      .sort(byOrder)
      .map(toNode),
  }))

  const crossCutting = groups
    .filter((g) => (g.category_slug ?? null) === null)
    .sort(byOrder)
    .map(toNode)

  const facets: Partial<Record<TagGroup, Tag[]>> = {}
  for (const tag of tags) {
    if (tag.tag_group === SUBJECT_TAG_GROUP) continue
    ;(facets[tag.tag_group] ??= []).push(tag)
  }
  for (const key of Object.keys(facets) as TagGroup[]) facets[key]!.sort(byOrder)

  return { pillars, crossCutting, facets }
}

/** Subject groups (with their leaves) for a single pillar. */
export function subjectsForPillar(tree: TagTree, pillar: CategorySlug): SubjectNode[] {
  return tree.pillars.find((p) => p.slug === pillar)?.subjects ?? []
}

/** Flat list of every subject slug relevant to a pillar (its groups + leaves + cross-cutting). */
export function subjectSlugsForPillar(tree: TagTree, pillar: CategorySlug): string[] {
  const own = subjectsForPillar(tree, pillar).flatMap((g) => [g.slug, ...g.children.map((c) => c.slug)])
  const cross = tree.crossCutting.map((g) => g.slug)
  return [...own, ...cross]
}
