export type TagGroup = 'life-stage' | 'price' | 'use-case' | 'test-depth' | 'editorial' | 'topic'

export interface Tag {
  slug: string
  label: string
  tag_group: TagGroup
  display_order: number
}

export const TAG_GROUP_LABELS: Record<TagGroup, string> = {
  'life-stage':  'Life Stage',
  'price':       'Price',
  'use-case':    'Use Case',
  'test-depth':  'Test Depth',
  'editorial':   'Editorial',
  'topic':       'Topic',
}

export const TAG_GROUP_ORDER: TagGroup[] = [
  'editorial', 'test-depth', 'life-stage', 'price', 'use-case', 'topic',
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
