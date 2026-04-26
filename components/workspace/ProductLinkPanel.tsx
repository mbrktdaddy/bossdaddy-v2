'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { extractH2Headings, insertAtPosition } from '@/lib/inlineImages'
import {
  type ProductMention,
  extractMentions,
  moveMentionToPosition,
  removeMentionAtPosition,
} from '@/lib/productMentions'

interface Product {
  id: string
  slug: string
  name: string
  store: string
  affiliate_url: string | null
  non_affiliate_url: string | null
}

interface Props {
  content: string
  onChangeContent: (next: string) => void
}

export function ProductLinkPanel({ content, onChangeContent }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [posKey, setPosKey] = useState<string>('end')

  const headings = useMemo(() => extractH2Headings(content), [content])
  const mentions = useMemo(() => extractMentions(content, products), [content, products])

  function resolvePosition() {
    if (posKey === 'start') return { kind: 'start' as const }
    if (posKey === 'end')   return { kind: 'end' as const }
    return { kind: 'afterHeading' as const, index: Number(posKey.replace('h-', '')) }
  }

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/products')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load products')
      setProducts((json.products ?? []) as Product[])
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  function insertProduct(slug: string) {
    onChangeContent(insertAtPosition(content, `<p>[[BUY:${slug}]]</p>`, resolvePosition()))
  }
  function handleMove(currentPos: number, targetPos: number) {
    onChangeContent(moveMentionToPosition(content, currentPos, targetPos, products))
  }
  function handleRemove(position: number) {
    if (!confirm('Remove this product mention from the article?')) return
    onChangeContent(removeMentionAtPosition(content, position, products))
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
    : products

  // Map slug → product so existing mentions can show the friendly name
  const bySlug = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products) m.set(p.slug, p)
    return m
  }, [products])

  const positionOptions = [
    { value: 'start', label: 'Start of article' },
    ...headings.map((h, i) => ({
      value: `h-${i}`,
      label: `After: ${h.text.length > 40 ? h.text.slice(0, 40) + '…' : h.text}`,
    })),
    { value: 'end', label: 'End of article' },
  ]

  return (
    <details className="bg-gray-900 border border-gray-800 rounded-xl">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-orange-400">🛒</span> Inline product mentions
          {mentions.length > 0 && (
            <span className="px-2 py-0.5 bg-orange-950/40 border border-orange-900/40 text-orange-400 rounded-full text-xs">
              {mentions.length} in article
            </span>
          )}
        </span>
      </summary>

      <div className="px-4 pb-4 space-y-4">

        {/* ── Currently mentioned ─────────────────────────────────────── */}
        {mentions.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Currently mentioned</p>
            {mentions.map((mention) => (
              <ExistingMentionCard
                key={`${mention.position}-${mention.slug}`}
                mention={mention}
                productName={bySlug.get(mention.slug)?.name}
                total={mentions.length}
                onMove={(toPos) => handleMove(mention.position, toPos)}
                onRemove={() => handleRemove(mention.position)}
              />
            ))}
          </section>
        )}

        {/* ── Insert new ──────────────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Add a mention</p>

          {loading && (
            <div className="flex items-center gap-2 text-gray-500 py-2 text-sm">
              <div className="w-3 h-3 border-2 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
              Loading products…
            </div>
          )}

          {loaded && products.length === 0 && (
            <p className="text-sm text-gray-600 py-2">
              No products yet.{' '}
              <Link href="/dashboard/admin/products/new" className="text-orange-400 hover:text-orange-300">Add one →</Link>
            </p>
          )}

          {loaded && products.length > 0 && (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Insert at position</label>
                <select
                  value={posKey}
                  onChange={(e) => setPosKey(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {positionOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name or slug…"
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filtered.map((p) => {
                  const token = `[[BUY:${p.slug}]]`
                  const alreadyMentioned = mentions.some((m) => m.slug === p.slug)
                  const tag = p.affiliate_url
                    ? { label: p.store === 'amazon' ? 'Amazon' : 'Affiliate', cls: 'bg-orange-950/40 text-orange-400 border-orange-900/40' }
                    : p.non_affiliate_url ? { label: 'Link', cls: 'bg-gray-800 text-gray-300 border-gray-700' }
                    : { label: 'No URL', cls: 'bg-red-950/40 text-red-400 border-red-900/40' }

                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-950 border border-gray-800 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${tag.cls}`}>{tag.label}</span>
                          <p className="text-sm text-white truncate">{p.name}</p>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          <code className="text-orange-400">{token}</code>
                        </p>
                      </div>
                      {alreadyMentioned ? (
                        <span
                          title="Already mentioned in this article"
                          className="shrink-0 text-xs px-3 py-2 bg-green-950/40 border border-green-900/40 text-green-400 rounded-lg min-h-[36px]"
                        >
                          ✓ In article
                        </span>
                      ) : (
                        <button
                          onClick={() => insertProduct(p.slug)}
                          className="shrink-0 text-xs px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg min-h-[36px] transition-colors"
                        >
                          + Insert
                        </button>
                      )}
                    </div>
                  )
                })}
                {filtered.length === 0 && (
                  <p className="text-xs text-gray-600 py-2">No products match that filter.</p>
                )}
              </div>

              <button
                onClick={load}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                ↻ Refresh
              </button>
            </>
          )}
        </section>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded px-3 py-2">{error}</p>
        )}
      </div>
    </details>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
interface ExistingMentionCardProps {
  mention: ProductMention
  productName?: string
  total: number
  onMove: (toPos: number) => void
  onRemove: () => void
}

function ExistingMentionCard({ mention, productName, total, onMove, onRemove }: ExistingMentionCardProps) {
  const kindLabel =
    mention.kind === 'token'         ? 'Token (resolves on save)' :
    mention.kind === 'anchor-tagged' ? 'Affiliate anchor' :
                                       'Anchor (legacy)'

  const kindCls =
    mention.kind === 'token' ? 'bg-orange-950/40 text-orange-400 border-orange-900/40' :
                                'bg-green-950/40 text-green-400 border-green-900/40'

  return (
    <div className="p-3 bg-gray-950 border border-gray-800 rounded-lg space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${kindCls}`}>{kindLabel}</span>
          <select
            value={mention.position}
            onChange={(e) => onMove(Number(e.target.value))}
            disabled={total <= 1}
            className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white min-h-[36px] focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
            title="Move to position"
          >
            {Array.from({ length: total }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>Position {n} of {total}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(mention.position - 1)}
            disabled={mention.position === 1}
            className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Move up"
          >↑</button>
          <button
            type="button"
            onClick={() => onMove(mention.position + 1)}
            disabled={mention.position === total}
            className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Move down"
          >↓</button>
          <button
            type="button"
            onClick={onRemove}
            className="px-2.5 py-1.5 bg-transparent hover:bg-red-950/40 text-gray-500 hover:text-red-400 text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Remove mention"
          >🗑</button>
        </div>
      </div>
      <div>
        <p className="text-sm text-white truncate">{productName ?? mention.slug}</p>
        <p className="text-xs text-gray-500 truncate" title={mention.label}>{mention.label}</p>
      </div>
    </div>
  )
}
