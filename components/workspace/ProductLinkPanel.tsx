'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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

  // useCallback so `load` is referentially stable across renders — lets the
  // mount-effect declare it as a dep cleanly without re-firing on every render.
  const load = useCallback(async () => {
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
  }, [])

  useEffect(() => { load() }, [load])

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
    <details className="bg-surface border border-soft rounded-xl">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-accent-text-soft">🛒</span> Inline product mentions
          {mentions.length > 0 && (
            <span className="px-2 py-0.5 bg-accent-tint border border-accent-border/40 text-accent-text-soft rounded-full text-xs">
              {mentions.length} in article
            </span>
          )}
        </span>
      </summary>

      <div className="px-4 pb-4 space-y-4">

        {/* ── Currently mentioned ─────────────────────────────────────── */}
        {mentions.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs text-prose-faint uppercase tracking-widest font-semibold">Currently mentioned</p>
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
          <p className="text-xs text-prose-faint uppercase tracking-widest font-semibold">Add a mention</p>

          {loading && (
            <div className="flex items-center gap-2 text-prose-faint py-2 text-sm">
              <div className="w-3 h-3 border-2 border-strong border-t-orange-500 rounded-full animate-spin" />
              Loading products…
            </div>
          )}

          {loaded && products.length === 0 && (
            <p className="text-sm text-prose-faint py-2">
              No products yet.{' '}
              <Link href="/dashboard/admin/products/new" className="text-accent-text-soft hover:text-accent">Add one →</Link>
            </p>
          )}

          {loaded && products.length > 0 && (
            <>
              <div>
                <label className="block text-xs text-prose-muted mb-1">Insert at position</label>
                <select
                  value={posKey}
                  onChange={(e) => setPosKey(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-sunken border border-strong rounded-lg text-sm text-prose focus:outline-none focus:ring-1 focus:ring-accent-hover"
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
                className="w-full px-3 py-2 bg-surface-sunken border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
              />

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filtered.map((p) => {
                  const token = `[[BUY:${p.slug}]]`
                  const alreadyMentioned = mentions.some((m) => m.slug === p.slug)
                  const tag = p.affiliate_url
                    ? { label: p.store === 'amazon' ? 'Amazon' : 'Affiliate', cls: 'bg-accent-tint text-accent-text-soft border-accent-border/40' }
                    : p.non_affiliate_url ? { label: 'Link', cls: 'bg-surface-raised text-prose-muted border-strong' }
                    : { label: 'No URL', cls: 'bg-red-950/40 text-red-300 border-red-700/40' }

                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 bg-surface-sunken border border-soft rounded-lg">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${tag.cls}`}>{tag.label}</span>
                          <p className="text-sm text-prose truncate">{p.name}</p>
                        </div>
                        <p className="text-xs text-prose-faint truncate">
                          <code className="text-accent-text-soft">{token}</code>
                        </p>
                      </div>
                      {alreadyMentioned ? (
                        <span
                          title="Already mentioned in this article"
                          className="shrink-0 text-xs px-3 py-2 bg-green-950/40 border border-green-700/40 text-forest rounded-lg min-h-[36px]"
                        >
                          ✓ In article
                        </span>
                      ) : (
                        <button
                          onClick={() => insertProduct(p.slug)}
                          className="shrink-0 text-xs px-3 py-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg min-h-[36px] transition-colors"
                        >
                          + Insert
                        </button>
                      )}
                    </div>
                  )
                })}
                {filtered.length === 0 && (
                  <p className="text-xs text-prose-faint py-2">No products match that filter.</p>
                )}
              </div>

              <button
                onClick={load}
                className="text-xs text-prose-faint hover:text-prose transition-colors"
              >
                ↻ Refresh
              </button>
            </>
          )}
        </section>

        {error && (
          <p className="text-xs text-red-300 bg-red-950/40 border border-red-700/40 rounded px-3 py-2">{error}</p>
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
    mention.kind === 'token' ? 'bg-accent-tint text-accent-text-soft border-accent-border/40' :
                                'bg-green-950/40 text-forest border-green-700/40'

  return (
    <div className="p-3 bg-surface-sunken border border-soft rounded-lg space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${kindCls}`}>{kindLabel}</span>
          <select
            value={mention.position}
            onChange={(e) => onMove(Number(e.target.value))}
            disabled={total <= 1}
            className="px-2 py-1.5 bg-surface border border-strong rounded-lg text-xs text-prose min-h-[36px] focus:outline-none focus:ring-1 focus:ring-accent-hover disabled:opacity-50"
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
            className="px-2.5 py-1.5 bg-surface-raised hover:bg-zinc-700 disabled:opacity-30 text-prose-muted text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Move up"
          >↑</button>
          <button
            type="button"
            onClick={() => onMove(mention.position + 1)}
            disabled={mention.position === total}
            className="px-2.5 py-1.5 bg-surface-raised hover:bg-zinc-700 disabled:opacity-30 text-prose-muted text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Move down"
          >↓</button>
          <button
            type="button"
            onClick={onRemove}
            className="px-2.5 py-1.5 bg-transparent hover:bg-red-950/40 text-prose-faint hover:text-red-300 text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Remove mention"
          >🗑</button>
        </div>
      </div>
      <div>
        <p className="text-sm text-prose truncate">{productName ?? mention.slug}</p>
        <p className="text-xs text-prose-faint truncate" title={mention.label}>{mention.label}</p>
      </div>
    </div>
  )
}
