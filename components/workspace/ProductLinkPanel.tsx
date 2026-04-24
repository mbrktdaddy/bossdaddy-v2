'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Product {
  id: string
  slug: string
  name: string
  amazon_url: string | null
  non_affiliate_url: string | null
}

interface Props {
  content: string
  onInsert: (markup: string) => void
}

export function ProductLinkPanel({ content, onInsert }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

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

  // Auto-load the first time the panel is opened — cheap query, saves a click.
  useEffect(() => { load() }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? products.filter((p) =>
        p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
    : products

  // After the first save, [[BUY:slug]] has been resolved into an <a href="…">
  // anchor tag in the stored HTML — the raw token string is gone. Checking
  // only `content.includes(token)` would falsely report "not inserted" and
  // let editors paste a duplicate. Also match the resolved anchor by href.
  function isAlreadyInserted(p: Product): boolean {
    if (content.includes(`[[BUY:${p.slug}]]`)) return true
    if (p.amazon_url && content.includes(p.amazon_url)) return true
    if (p.non_affiliate_url && content.includes(p.non_affiliate_url)) return true
    return false
  }

  return (
    <details className="bg-gray-900 border border-gray-800 rounded-xl">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-orange-400">🛒</span> Insert inline product mention
        </span>
        <span className="text-xs text-gray-600">Optional — primary CTA is the Primary Product card</span>
      </summary>

      <div className="px-4 pb-4 space-y-3">
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
                const alreadyInserted = isAlreadyInserted(p)
                const tag = p.amazon_url ? { label: 'Amazon', cls: 'bg-orange-950/40 text-orange-400 border-orange-900/40' }
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
                    {alreadyInserted ? (
                      <span
                        title="Token already present in content"
                        className="shrink-0 text-xs px-3 py-1.5 bg-green-950/40 border border-green-900/40 text-green-400 rounded-lg"
                      >
                        ✓ Inserted
                      </span>
                    ) : (
                      <button
                        onClick={() => onInsert(`<p>${token}</p>`)}
                        className="shrink-0 text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg transition-colors"
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

        {error && (
          <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded px-3 py-2">{error}</p>
        )}
      </div>
    </details>
  )
}
