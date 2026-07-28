'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildTagTree,
  TAG_GROUP_LABELS,
  TAG_GROUP_ORDER,
  type SubjectNode,
  type Tag,
  type TagGroup,
} from '@/lib/tags'

interface Props {
  selected: string[]
  onChange: (slugs: string[]) => void
}

/** A pillar (or the cross-cutting bucket) rendered as one collapsible section. */
interface Section {
  key: string
  label: string
  subjects: SubjectNode[]
}

const CROSS_CUTTING_KEY = '__cross-cutting'

export function TagPicker({ selected, onChange }: Props) {
  const [tags, setTags]       = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery]     = useState('')
  // Explicit open/closed overrides, keyed by section. Unset = auto (open when it
  // holds a selection).
  const [open, setOpen]       = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/tags')
      .then((r) => r.json())
      .then(({ tags }: { tags: Tag[] }) => setTags(tags ?? []))
      .finally(() => setLoading(false))
  }, [])

  const tree = useMemo(() => buildTagTree(tags), [tags])

  const q = query.trim().toLowerCase()
  const matches = (tag: Tag) => !q || tag.label.toLowerCase().includes(q)

  /** Keep a group when it matches, or when any of its leaves do (leaves narrowed). */
  const narrow = (subjects: SubjectNode[]): SubjectNode[] => {
    if (!q) return subjects
    return subjects
      .map((s) => (matches(s) ? s : { ...s, children: s.children.filter(matches) }))
      .filter((s) => matches(s) || s.children.length > 0)
  }

  const countSelected = (subjects: SubjectNode[]) =>
    subjects.reduce(
      (n, s) =>
        n +
        (selected.includes(s.slug) ? 1 : 0) +
        s.children.filter((c) => selected.includes(c.slug)).length,
      0
    )

  const sections: Section[] = useMemo(() => {
    const pillars: Section[] = tree.pillars
      .filter((p) => p.subjects.length > 0)
      .map((p) => ({ key: p.slug, label: p.label, subjects: p.subjects }))
    return tree.crossCutting.length
      ? [...pillars, { key: CROSS_CUTTING_KEY, label: 'Cross-Cutting', subjects: tree.crossCutting }]
      : pillars
  }, [tree])

  function toggle(slug: string) {
    onChange(
      selected.includes(slug)
        ? selected.filter((s) => s !== slug)
        : [...selected, slug]
    )
  }

  if (loading) return <div className="h-20 bg-surface-sunken border border-soft rounded-xl animate-pulse" />

  const chip = (tag: Tag) => {
    const active = selected.includes(tag.slug)
    return (
      <button
        key={tag.slug}
        type="button"
        onClick={() => toggle(tag.slug)}
        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
          active
            ? 'bg-accent text-white'
            : 'bg-surface text-prose-muted hover:text-prose hover:bg-surface-raised border border-strong'
        }`}
      >
        {tag.label}
      </button>
    )
  }

  const facetGroups = TAG_GROUP_ORDER.filter((g) => g !== 'topic')

  return (
    <div className="space-y-4">
      {/* Facets — flat, they cut across every pillar */}
      {facetGroups.map((group: TagGroup) => {
        const facets = (tree.facets[group] ?? []).filter(matches)
        if (!facets.length) return null
        return (
          <div key={group}>
            <p className="text-xs text-prose-faint uppercase tracking-widest font-semibold mb-2">
              {TAG_GROUP_LABELS[group]}
            </p>
            <div className="flex flex-wrap gap-1.5">{facets.map(chip)}</div>
          </div>
        )
      })}

      {/* Subjects — pillar → subject group → leaf */}
      {sections.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-xs text-prose-faint uppercase tracking-widest font-semibold">
              {TAG_GROUP_LABELS.topic}
            </p>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter topics…"
              className="w-40 px-2.5 py-1 rounded-full text-xs bg-surface border border-strong text-prose placeholder:text-prose-faint focus:outline-none focus:border-accent"
            />
          </div>

          <div className="divide-y divide-soft border border-soft rounded-xl overflow-hidden">
            {sections.map((section) => {
              const subjects = narrow(section.subjects)
              if (!subjects.length) return null
              const count    = countSelected(section.subjects)
              const expanded = q ? true : (open[section.key] ?? count > 0)
              return (
                <div key={section.key}>
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [section.key]: !expanded }))}
                    aria-expanded={expanded}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-surface-sunken hover:bg-surface-raised transition-colors"
                  >
                    <span className={`text-prose-faint text-[10px] transition-transform ${expanded ? 'rotate-90' : ''}`}>
                      ▶
                    </span>
                    <span className="text-xs font-semibold text-prose">{section.label}</span>
                    {count > 0 && (
                      <span className="text-[10px] font-semibold text-accent-text">{count} selected</span>
                    )}
                  </button>

                  {expanded && (
                    <div className="px-3 py-2.5 space-y-2">
                      {subjects.map((group) => (
                        <div key={group.slug}>
                          <div className="flex flex-wrap gap-1.5">{chip(group)}</div>
                          {group.children.length > 0 && (
                            <div className="mt-1.5 ml-2 pl-2.5 border-l border-soft flex flex-wrap gap-1.5">
                              {group.children.map(chip)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
