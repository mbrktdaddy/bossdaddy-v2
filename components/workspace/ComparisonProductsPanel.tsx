'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface Spec { label: string; value: string }
interface Product {
  id: string
  slug: string
  name: string
  brand: string | null
  category: string | null
  image_url: string | null
  specs: Spec[]
}

interface Props {
  value: string[]
  onChange: (slugs: string[]) => void
  /** The review's category — competitors are drawn from the same one. */
  category: string | null
  /** The reviewed product's slug — excluded from the options. */
  primarySlug: string | null
  max?: number
}

function specCount(p: Product): number {
  return (Array.isArray(p.specs) ? p.specs : []).filter((s) => s?.label?.trim() && s?.value?.trim()).length
}

/**
 * Optional head-to-head competitor picker for a review. Mirrors
 * PrimaryProductPanel's fetch/UI, but multi-selects up to `max` OTHER products
 * in the same category (any brand, including different models of the same
 * brand). Selecting none = no comparison table on the review (specs still power
 * the prose + structured data). Editors can revise the set here at any time.
 */
export function ComparisonProductsPanel({ value, onChange, category, primarySlug, max = 4 }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [query, setQuery]       = useState('')

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

  const options = category
    ? products.filter((p) => p.category === category && p.slug !== primarySlug)
    : []
  // Resolve chips from the FULL list so a selection stays visible/removable even
  // if the review's category later changes (the add list stays category-scoped).
  const selected = value.map((slug) => products.find((p) => p.slug === slug)).filter(Boolean) as Product[]
  const atCap = value.length >= max

  const q = query.trim().toLowerCase()
  const addable = options.filter((p) => !value.includes(p.slug) && (q ? p.name.toLowerCase().includes(q) || (p.brand ?? '').toLowerCase().includes(q) : true))

  function toggle(slug: string) {
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : atCap ? value : [...value, slug])
  }

  return (
    <div className="bg-surface border border-soft rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div>
          <p className="text-sm font-semibold text-prose flex items-center gap-2">
            <span className="text-accent-text-soft">⚖</span> Compare Against
          </p>
          <p className="text-xs text-prose-faint mt-0.5">
            Optional — up to {max} same-category rivals. Renders a spec table on the review and grounds the draft. Leave empty for a specs-only review.
          </p>
        </div>
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-xs text-prose-faint hover:text-red-700 transition-colors shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      {!category ? (
        <p className="text-sm text-prose-faint py-1">Set a category above to pick competitors.</p>
      ) : (
        <>
          {loading && (
            <div className="flex items-center gap-2 text-prose-faint py-2 text-sm">
              <div className="w-3 h-3 border-2 border-strong border-t-orange-500 rounded-full animate-spin" />
              Loading products…
            </div>
          )}
          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2">{error}</p>
          )}

          {!loading && !error && options.length === 0 && (
            <p className="text-sm text-prose-faint py-1">
              No other products in this category yet.{' '}
              <Link href="/dashboard/admin/products/new" className="text-accent-text-soft hover:text-accent">Add one →</Link>
            </p>
          )}

          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selected.map((p) => {
                const n = specCount(p)
                return (
                  <span key={p.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 bg-accent-tint border border-accent-border/40 rounded-lg text-xs text-prose">
                    {p.brand && <span className="text-prose-faint">{p.brand} ·</span>}
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-prose-faint">· {n} spec{n === 1 ? '' : 's'}</span>
                    <button
                      onClick={() => toggle(p.slug)}
                      aria-label={`Remove ${p.name}`}
                      className="ml-0.5 px-1 text-prose-faint hover:text-red-700 transition-colors"
                    >
                      ✕
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {/* Add list */}
          {!loading && options.length > 0 && !atCap && (
            <div className="space-y-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name or brand…"
                className="w-full px-3 py-2 bg-surface-sunken border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
              />
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {addable.map((p) => {
                  const n = specCount(p)
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.slug)}
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
                        <p className="text-sm text-prose truncate">{p.brand ? `${p.brand} · ` : ''}{p.name}</p>
                        <p className="text-xs text-prose-faint truncate">{p.slug}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 bg-surface border border-soft ${n === 0 ? 'text-warn-ink' : 'text-prose-faint'}`}>
                        {n} spec{n === 1 ? '' : 's'}
                      </span>
                    </button>
                  )
                })}
                {addable.length === 0 && (
                  <p className="text-xs text-prose-faint py-1">No more products match.</p>
                )}
              </div>
            </div>
          )}

          {atCap && (
            <p className="text-xs text-prose-faint">Max {max} selected. Remove one to add another.</p>
          )}
        </>
      )}
    </div>
  )
}
