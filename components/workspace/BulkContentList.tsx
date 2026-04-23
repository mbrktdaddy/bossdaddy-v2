'use client'

import { useState } from 'react'
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
  updated_at: string
  reading_time_minutes: number | null
  rejection_reason: string | null
  // Review-specific fields (optional)
  product_name?: string | null
  rating?: number | null
}

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

  const publicRoute = contentType === 'articles' ? '/articles' : '/reviews'

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected((s) => s.size === items.length ? new Set() : new Set(items.map((i) => i.id)))
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

  const allSelected = selected.size === items.length

  return (
    <>
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
      </div>

      {/* List */}
      <div className="space-y-2">
        {items.map((item) => {
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

                <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center shrink-0 text-lg mt-0.5">
                  {contentType === 'reviews' && item.rating !== undefined && item.rating !== null
                    ? <span className="text-sm font-bold text-yellow-400">{item.rating}</span>
                    : (category?.icon ?? (contentType === 'articles' ? '📝' : '⭐'))}
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
