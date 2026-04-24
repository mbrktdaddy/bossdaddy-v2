'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface Product {
  id: string
  slug: string
  name: string
  amazon_url: string | null
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="text-orange-400">★</span> Primary Product
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Drives the product CTA card shown on the public review page.
          </p>
        </div>
        {selected && (
          <button
            onClick={() => onChange(null)}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 py-2 text-sm">
          <div className="w-3 h-3 border-2 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
          Loading products…
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded px-3 py-2">{error}</p>
      )}

      {!loading && !error && products.length === 0 && (
        <p className="text-sm text-gray-500 py-2">
          No products yet.{' '}
          <Link href="/dashboard/admin/products/new" className="text-orange-400 hover:text-orange-300">Add one →</Link>
        </p>
      )}

      {!loading && selected && !picking && (
        <div className="flex items-center gap-3 p-3 bg-gray-950 border border-orange-900/40 rounded-lg">
          {selected.image_url && (
            <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-900 border border-gray-800">
              <Image src={selected.image_url} alt={selected.name} fill className="object-contain p-1" sizes="56px" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{selected.name}</p>
            <p className="text-xs text-gray-500 truncate">{selected.slug}</p>
          </div>
          <button
            onClick={() => setPicking(true)}
            className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors shrink-0"
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
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => { onChange(p.slug); setPicking(false); setQuery('') }}
                className="w-full flex items-center gap-3 p-2 bg-gray-950 border border-gray-800 hover:border-orange-700/60 rounded-lg transition-colors text-left"
              >
                {p.image_url ? (
                  <div className="relative w-10 h-10 shrink-0 rounded overflow-hidden bg-gray-900">
                    <Image src={p.image_url} alt="" fill className="object-contain p-0.5" sizes="40px" />
                  </div>
                ) : (
                  <div className="w-10 h-10 shrink-0 rounded bg-gray-900 border border-gray-800" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{p.name}</p>
                  <p className="text-xs text-gray-600 truncate">{p.slug}</p>
                </div>
                {!p.amazon_url && !p.non_affiliate_url && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/40 border border-red-900/40 text-red-400 shrink-0">
                    No URL
                  </span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-gray-600 py-2">No products match that filter.</p>
            )}
          </div>
          {picking && (
            <button
              onClick={() => { setPicking(false); setQuery('') }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
