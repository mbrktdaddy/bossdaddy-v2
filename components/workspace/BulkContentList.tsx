'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getCategoryBySlug } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'
import { StatusBadge } from './StatusBadge'

export interface BulkListItem {
  id: string
  title: string
  category: string
  status: string
  slug: string | null
  created_at: string | null
  updated_at: string | null
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
  contentType: 'guides' | 'reviews'
  emptyMessage: string
}

export function BulkContentList({ items, contentType, emptyMessage }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<'publish' | 'unpublish' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('updated')

  const publicRoute = contentType === 'guides' ? '/guides' : '/reviews'

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q ? items.filter((i) => i.title.toLowerCase().includes(q)) : items
    return [...filtered].sort((a, b) => {
      if (sortKey === 'az') return a.title.localeCompare(b.title)
      if (sortKey === 'created') return new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime()
      return new Date(b.updated_at ?? '').getTime() - new Date(a.updated_at ?? '').getTime()
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
      <div className="text-center py-24 border border-dashed border-soft rounded-xl">
        <p className="text-prose-faint text-lg">{emptyMessage}</p>
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
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-prose-faint pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            className="w-full pl-9 pr-3 py-2 bg-surface border border-soft rounded-xl text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:border-accent/60"
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
                  ? 'bg-accent-tint text-accent-text-soft border border-accent-border/50'
                  : 'bg-surface text-prose-faint border border-soft hover:border-strong hover:text-prose'
              }`}
            >
              {SORT_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Select all header */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-prose-faint hover:text-prose">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="rounded accent-orange-500"
          />
          {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
        </label>
        {search && (
          <span className="text-xs text-prose-faint">{filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* No search results */}
      {filteredItems.length === 0 && (
        <div className="text-center py-16 border border-dashed border-soft rounded-xl">
          <p className="text-prose-faint">No results for &ldquo;{search}&rdquo;</p>
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
              className={`p-4 rounded-xl border transition-colors ${
                isSelected
                  ? 'bg-accent-tint border-accent/50'
                  : 'bg-surface border-soft hover:border-strong'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(item.id)}
                  className="mt-1.5 rounded accent-orange-500 shrink-0"
                />

                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-surface-raised border border-strong/50 shrink-0 mt-0.5">
                  {item.image_url ? (
                    <Image src={item.image_url} alt={item.title} fill className="object-cover" sizes="48px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {contentType === 'reviews' && item.rating !== undefined && item.rating !== null
                        ? <span className="text-sm font-bold text-amber-300">{item.rating}</span>
                        : (category ? <CategoryIcon slug={category.slug} className="w-5 h-5 text-accent-text" /> : (
                          contentType === 'guides' ? (
                            <svg className="w-5 h-5 text-accent-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-accent-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                            </svg>
                          )
                        ))}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm leading-snug">{item.title}</p>
                    <StatusBadge status={item.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.product_name && <span className="text-xs text-prose-faint">{item.product_name}</span>}
                    {category && <span className={`flex items-center gap-1 text-xs ${category.accent}`}><CategoryIcon slug={category.slug} className="w-3.5 h-3.5 text-accent-text" /> {category.label}</span>}
                    {item.reading_time_minutes && <span className="text-xs text-prose-faint">{item.reading_time_minutes} min</span>}
                    <span className="text-xs text-prose-faint">
                      {new Date(item.updated_at ?? '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                    </span>
                  </div>
                  {item.rejection_reason && ['draft', 'rejected'].includes(item.status) && (
                    <p className="text-xs text-amber-300/80 mt-1.5">↩ Edits requested: {item.rejection_reason}</p>
                  )}
                  {item.status === 'pending' && (
                    <p className="text-xs text-prose-faint mt-1.5">
                      In review queue.
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Link
                      href={`/dashboard/${contentType}/${item.id}`}
                      className="text-xs px-3 py-1.5 bg-surface-raised hover:bg-zinc-700 text-prose-muted hover:text-prose rounded-lg transition-colors"
                    >
                      {['draft', 'rejected'].includes(item.status) ? 'Edit' : 'Open'}
                    </Link>
                    {item.status === 'approved' && item.slug && (
                      <Link
                        href={`${publicRoute}/${item.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 bg-accent-tint hover:bg-accent-tint text-accent-text-soft hover:text-accent rounded-lg transition-colors border border-accent-border/40"
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
          <div className="mx-auto max-w-2xl bg-surface border border-accent/40 rounded-xl shadow-2xl p-3 flex items-center gap-3 flex-wrap">
            <p className="text-sm text-prose font-semibold shrink-0">{selected.size} selected</p>
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <button
                onClick={() => runAction('publish')}
                disabled={!!busy}
                className="px-3 py-1.5 text-xs font-semibold bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {busy === 'publish' ? '…' : 'Publish'}
              </button>
              <button
                onClick={() => runAction('unpublish')}
                disabled={!!busy}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-950/40 hover:bg-amber-950/40 disabled:opacity-50 text-amber-300 rounded-lg transition-colors border border-amber-700/40"
              >
                {busy === 'unpublish' ? '…' : 'Unpublish'}
              </button>
              <button
                onClick={() => runAction('delete')}
                disabled={!!busy}
                className="px-3 py-1.5 text-xs font-semibold bg-red-950/40 hover:bg-red-950/40 disabled:opacity-50 text-red-300 rounded-lg transition-colors border border-red-700/40"
              >
                {busy === 'delete' ? '…' : 'Delete'}
              </button>
            </div>
            <button
              onClick={clear}
              className="text-xs text-prose-faint hover:text-prose transition-colors shrink-0"
            >
              Clear
            </button>
          </div>
          {error && (
            <p className="mt-2 mx-auto max-w-2xl text-xs text-red-300 bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  )
}
