'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getCategoryBySlug } from '@/lib/categories'
import { StatusBadge } from './StatusBadge'

export interface BulkListItem {
  id: string
  title: string
  category: string
  status: string
  slug: string | null
  created_at: string
  updated_at: string
  reading_time_minutes: number | null
  rejection_reason: string | null
  image_url?: string | null
  // Review-specific fields (optional)
  product_name?: string | null
  rating?: number | null
}

type SortKey = 'updated' | 'created' | 'az'

interface Props {
  items: BulkListItem[]
  contentType: 'articles' | 'reviews'
  emptyMessage: string
}

export function BulkContentList({ items, contentType, emptyMessage }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<'publish' | 'unpublish' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('updated')

  const publicRoute = contentType === 'articles' ? '/articles' : '/reviews'

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q ? items.filter((i) => i.title.toLowerCase().includes(q)) : items
    return [...filtered].sort((a, b) => {
      if (sortKey === 'az') return a.title.localeCompare(b.title)
      if (sortKey === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [items, search, sortKey])

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected((s) => s.size === filteredItems.length ? new Set() : new Set(filteredItems.map((i) => i.id)))
  }
  function clear() { setSelected(new Set()) }

  async function runAction(action: 'publish' | 'unpublish' | 'delete') {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (action === 'delete' && !confirm(`Delete ${ids.length} item${ids.length > 1 ? 's' : ''} permanently? This cannot be undone.`)) return

    setBusy(action); setError(null)
    const res = await fetch(`/api/${contentType}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'Bulk action failed')
      setBusy(null)
      return
    }
    setSelected(new Set())
    setBusy(null)
    router.refresh()
  }

  if (!items.length) {
    return (
      <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
        <p className="text-gray-500 text-lg">{emptyMessage}</p>
      </div>
    )
  }

  const allSelected = filteredItems.length > 0 && selected.size === filteredItems.length

  const SORT_LABELS: Record<SortKey, string> = {
    updated: 'Recently updated',
    created: 'Newest first',
    az: 'A–Z',
  }

  return (
    <>
      {/* Search + sort toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-600/60"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortKey(key)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                sortKey === key
                  ? 'bg-orange-950/40 text-orange-400 border border-orange-800/50'
                  : 'bg-gray-900 text-gray-500 border border-gray-800 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {SORT_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Select all header */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-500 hover:text-gray-300">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="rounded accent-orange-500"
          />
          {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
        </label>
        {search && (
          <span className="text-xs text-gray-600">{filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* No search results */}
      {filteredItems.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-800 rounded-2xl">
          <p className="text-gray-500">No results for &ldquo;{search}&rdquo;</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {filteredItems.map((item) => {
          const category = getCategoryBySlug(item.category)
          const isSelected = selected.has(item.id)

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-colors ${
                isSelected
                  ? 'bg-orange-950/20 border-orange-600/50'
                  : 'bg-gray-900 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(item.id)}
                  className="mt-1.5 rounded accent-orange-500 shrink-0"
                />

                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-800 border border-gray-700/50 shrink-0 mt-0.5">
                  {item.image_url ? (
                    <Image src={item.image_url} alt={item.title} fill className="object-cover" sizes="48px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg">
                      {contentType === 'reviews' && item.rating !== undefined && item.rating !== null
                        ? <span className="text-sm font-bold text-yellow-400">{item.rating}</span>
                        : (category?.icon ?? (contentType === 'articles' ? '📝' : '⭐'))}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm leading-snug">{item.title}</p>
                    <StatusBadge status={item.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.product_name && <span className="text-xs text-gray-500">{item.product_name}</span>}
                    {category && <span className={`text-xs ${category.accent}`}>{category.icon} {category.label}</span>}
                    {item.reading_time_minutes && <span className="text-xs text-gray-600">{item.reading_time_minutes} min</span>}
                    <span className="text-xs text-gray-700">
                      {new Date(item.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {item.rejection_reason && ['draft', 'rejected'].includes(item.status) && (
                    <p className="text-xs text-yellow-400/80 mt-1.5">↩ Edits requested: {item.rejection_reason}</p>
                  )}
                  {item.status === 'pending' && (
                    <p className="text-xs text-gray-500 mt-1.5">
                      In review queue.
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Link
                      href={`/dashboard/${contentType}/${item.id}`}
                      className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors"
                    >
                      {['draft', 'rejected'].includes(item.status) ? 'Edit' : 'Open'}
                    </Link>
                    {item.status === 'approved' && item.slug && (
                      <Link
                        href={`${publicRoute}/${item.slug}`}
                        target="_blank"
                        className="text-xs px-3 py-1.5 bg-orange-950/50 hover:bg-orange-900/50 text-orange-400 hover:text-orange-300 rounded-lg transition-colors border border-orange-900/40"
                      >
                        View Live →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Sticky bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 mt-4 z-20">
          <div className="mx-auto max-w-2xl bg-gray-900 border border-orange-600/40 rounded-2xl shadow-2xl p-3 flex items-center gap-3 flex-wrap">
            <p className="text-sm text-white font-semibold shrink-0">{selected.size} selected</p>
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <button
                onClick={() => runAction('publish')}
                disabled={!!busy}
                className="px-3 py-1.5 text-xs font-semibold bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {busy === 'publish' ? '…' : '✓ Publish'}
              </button>
              <button
                onClick={() => runAction('unpublish')}
                disabled={!!busy}
                className="px-3 py-1.5 text-xs font-semibold bg-yellow-900/60 hover:bg-yellow-900 disabled:opacity-50 text-yellow-300 rounded-lg transition-colors border border-yellow-900/40"
              >
                {busy === 'unpublish' ? '…' : 'Unpublish'}
              </button>
              <button
                onClick={() => runAction('delete')}
                disabled={!!busy}
                className="px-3 py-1.5 text-xs font-semibold bg-red-950/60 hover:bg-red-900/60 disabled:opacity-50 text-red-400 rounded-lg transition-colors border border-red-900/40"
              >
                {busy === 'delete' ? '…' : '🗑 Delete'}
              </button>
            </div>
            <button
              onClick={clear}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0"
            >
              Clear
            </button>
          </div>
          {error && (
            <p className="mt-2 mx-auto max-w-2xl text-xs text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  )
}
