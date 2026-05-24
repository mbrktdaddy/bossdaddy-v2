'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface Product {
  id: string
  slug: string
  name: string
  affiliate_url: string | null
  non_affiliate_url: string | null
  image_url: string | null
}

interface Props {
  value: string | null
  onChange: (slug: string | null) => void
}

export function PrimaryProductPanel({ value, onChange }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [query, setQuery]       = useState('')
  const [picking, setPicking]   = useState(false)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError(null)
    fetch('/api/products')
      .then((r) => r.json().then((j) => ({ ok: r.ok, json: j })))
      .then(({ ok, json }) => {
        if (cancelled) return
        if (!ok) { setError(json.error ?? 'Failed to load products'); return }
        setProducts((json.products ?? []) as Product[])
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  const selected = value ? products.find((p) => p.slug === value) ?? null : null
  const q = query.trim().toLowerCase()
  const filtered = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
    : products

  return (
    <div className="bg-surface border border-soft rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-prose flex items-center gap-2">
            <span className="text-accent-text-soft">★</span> Primary Product
          </p>
          <p className="text-xs text-prose-faint mt-0.5">
            Drives the product CTA card shown on the public review page.
          </p>
        </div>
        {selected && (
          <button
            onClick={() => onChange(null)}
            className="text-xs text-prose-faint hover:text-red-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-prose-faint py-2 text-sm">
          <div className="w-3 h-3 border-2 border-strong border-t-orange-500 rounded-full animate-spin" />
          Loading products…
        </div>
      )}

      {error && (
        <p className="text-xs text-red-300 bg-red-950/40 border border-red-700/40 rounded px-3 py-2">{error}</p>
      )}

      {!loading && !error && products.length === 0 && (
        <p className="text-sm text-prose-faint py-2">
          No products yet.{' '}
          <Link href="/dashboard/admin/products/new" className="text-accent-text-soft hover:text-accent">Add one →</Link>
        </p>
      )}

      {!loading && selected && !picking && (
        <div className="flex items-center gap-3 p-3 bg-surface-sunken border border-accent-border/40 rounded-lg">
          {selected.image_url ? (
            <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-surface border border-soft">
              <Image src={selected.image_url} alt={selected.name} fill className="object-contain p-1" sizes="56px" />
            </div>
          ) : (
            <div className="w-14 h-14 shrink-0 rounded-lg border-2 border-dashed border-strong bg-surface flex items-center justify-center">
              <span className="text-xs text-prose-faint">No img</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-prose truncate">{selected.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-prose-faint truncate">{selected.slug}</p>
              <a
                href={`/dashboard/admin/products/${selected.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-text-soft hover:text-accent shrink-0 transition-colors"
              >
                Edit product →
              </a>
            </div>
          </div>
          <button
            onClick={() => setPicking(true)}
            className="text-xs px-3 py-1.5 bg-surface-raised hover:bg-zinc-700 text-prose-muted rounded-lg transition-colors shrink-0"
          >
            Change
          </button>
        </div>
      )}

      {!loading && products.length > 0 && (!selected || picking) && (
        <div className="space-y-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or slug…"
            className="w-full px-3 py-2 bg-surface-sunken border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
          />
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => { onChange(p.slug); setPicking(false); setQuery('') }}
                className="w-full flex items-center gap-3 p-2 bg-surface-sunken border border-soft hover:border-accent-border/60 rounded-lg transition-colors text-left"
              >
                {p.image_url ? (
                  <div className="relative w-10 h-10 shrink-0 rounded overflow-hidden bg-surface">
                    <Image src={p.image_url} alt="" fill className="object-contain p-0.5" sizes="40px" />
                  </div>
                ) : (
                  <div className="w-10 h-10 shrink-0 rounded border border-dashed border-strong bg-surface flex items-center justify-center">
                    <span className="text-[9px] text-prose-faint">No img</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-prose truncate">{p.name}</p>
                  <p className="text-xs text-prose-faint truncate">{p.slug}</p>
                </div>
                {!p.affiliate_url && !p.non_affiliate_url && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/40 border border-red-700/40 text-red-300 shrink-0">
                    No URL
                  </span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-prose-faint py-2">No products match that filter.</p>
            )}
          </div>
          {picking && (
            <button
              onClick={() => { setPicking(false); setQuery('') }}
              className="text-xs text-prose-faint hover:text-prose transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
