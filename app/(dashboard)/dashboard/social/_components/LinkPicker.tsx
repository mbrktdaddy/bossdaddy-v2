'use client'

import { useState, useEffect } from 'react'

export interface SourceLinks {
  reviews: { id: string; title: string; slug: string }[]
  guides:  { id: string; title: string; slug: string }[]
  merch:   { id: string; title: string; slug: string }[]
}

const SITE = 'https://www.bossdaddylife.com'

type LinkMode = 'none' | 'review' | 'guide' | 'gear' | 'custom'

interface Props {
  value: string | null
  onChange: (url: string | null) => void
  sourceLinks: SourceLinks
}

function modeFromUrl(url: string | null, sourceLinks: SourceLinks): { mode: LinkMode; id: string; custom: string } {
  if (!url) return { mode: 'none', id: '', custom: '' }
  if (url.includes('/reviews/')) {
    const slug = url.split('/reviews/')[1]
    const found = sourceLinks.reviews.find((r) => r.slug === slug)
    return { mode: 'review', id: found?.id ?? '', custom: '' }
  }
  if (url.includes('/guides/')) {
    const slug = url.split('/guides/')[1]
    const found = sourceLinks.guides.find((g) => g.slug === slug)
    return { mode: 'guide', id: found?.id ?? '', custom: '' }
  }
  if (url.includes('/gear/')) {
    const slug = url.split('/gear/')[1]
    const found = sourceLinks.merch.find((m) => m.slug === slug)
    return { mode: 'gear', id: found?.id ?? '', custom: '' }
  }
  return { mode: 'custom', id: '', custom: url }
}

export default function LinkPicker({ value, onChange, sourceLinks }: Props) {
  const parsed = modeFromUrl(value, sourceLinks)
  const [mode, setMode]       = useState<LinkMode>(parsed.mode)
  const [itemId, setItemId]   = useState(parsed.id)
  const [custom, setCustom]   = useState(parsed.custom)

  useEffect(() => {
    const p = modeFromUrl(value, sourceLinks)
    setMode(p.mode); setItemId(p.id); setCustom(p.custom)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function buildUrl(m: LinkMode, id: string, c: string): string | null {
    if (m === 'none') return null
    if (m === 'custom') return c.trim() || null
    const items = m === 'review' ? sourceLinks.reviews : m === 'guide' ? sourceLinks.guides : sourceLinks.merch
    const prefix = m === 'review' ? '/reviews/' : m === 'guide' ? '/guides/' : '/gear/'
    const item = items.find((i) => i.id === id)
    return item ? `${SITE}${prefix}${item.slug}` : null
  }

  function handleMode(m: LinkMode) {
    setMode(m)
    setItemId('')
    setCustom('')
    onChange(m === 'none' ? null : buildUrl(m, '', ''))
  }

  function handleItem(id: string) {
    setItemId(id)
    onChange(buildUrl(mode, id, custom))
  }

  function handleCustom(v: string) {
    setCustom(v)
    onChange(v.trim() || null)
  }

  const MODES: { key: LinkMode; label: string }[] = [
    { key: 'none',   label: 'None' },
    { key: 'review', label: 'Review' },
    { key: 'guide',  label: 'Guide' },
    { key: 'gear',   label: 'Gear' },
    { key: 'custom', label: 'Custom' },
  ]

  const builtUrl = buildUrl(mode, itemId, custom)

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 font-medium">Link (optional)</p>
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => handleMode(m.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              m.key === mode
                ? 'bg-orange-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {(mode === 'review' || mode === 'guide' || mode === 'gear') && (
        <select
          value={itemId}
          onChange={(e) => handleItem(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:border-orange-600 focus:outline-none"
        >
          <option value="">— Select —</option>
          {(mode === 'review' ? sourceLinks.reviews : mode === 'guide' ? sourceLinks.guides : sourceLinks.merch).map((item) => (
            <option key={item.id} value={item.id}>{item.title}</option>
          ))}
        </select>
      )}

      {mode === 'custom' && (
        <input
          type="url"
          value={custom}
          onChange={(e) => handleCustom(e.target.value)}
          placeholder="https://…"
          className="w-full bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:border-orange-600 focus:outline-none"
        />
      )}

      {builtUrl && (
        <p className="text-xs text-gray-500 truncate">
          ↳ <span className="text-orange-400">{builtUrl}</span>
          <span className="ml-2 text-gray-600">(counts as 23 chars on X)</span>
        </p>
      )}
    </div>
  )
}
