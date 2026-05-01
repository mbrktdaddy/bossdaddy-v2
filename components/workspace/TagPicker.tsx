'use client'

import { useEffect, useState } from 'react'
import { TAG_GROUP_LABELS, TAG_GROUP_ORDER, type Tag, type TagGroup } from '@/lib/tags'

interface Props {
  selected: string[]
  onChange: (slugs: string[]) => void
}

export function TagPicker({ selected, onChange }: Props) {
  const [grouped, setGrouped]   = useState<Partial<Record<TagGroup, Tag[]>>>({})
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/tags')
      .then((r) => r.json())
      .then(({ tags }: { tags: Tag[] }) => {
        const g: Partial<Record<TagGroup, Tag[]>> = {}
        for (const tag of tags) {
          if (!g[tag.tag_group as TagGroup]) g[tag.tag_group as TagGroup] = []
          g[tag.tag_group as TagGroup]!.push(tag)
        }
        setGrouped(g)
      })
      .finally(() => setLoading(false))
  }, [])

  function toggle(slug: string) {
    onChange(
      selected.includes(slug)
        ? selected.filter((s) => s !== slug)
        : [...selected, slug]
    )
  }

  if (loading) return <div className="h-20 bg-gray-950 border border-gray-800 rounded-xl animate-pulse" />

  return (
    <div className="space-y-4">
      {TAG_GROUP_ORDER.map((group) => {
        const tags = grouped[group]
        if (!tags?.length) return null
        return (
          <div key={group}>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">
              {TAG_GROUP_LABELS[group]}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const active = selected.includes(tag.slug)
                return (
                  <button
                    key={tag.slug}
                    type="button"
                    onClick={() => toggle(tag.slug)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700'
                    }`}
                  >
                    {tag.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
