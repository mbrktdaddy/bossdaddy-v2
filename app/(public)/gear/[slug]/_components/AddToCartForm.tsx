'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/merch'

interface Variant {
  id: string
  size: string | null
  color: string | null
  retail_price_cents: number
  in_stock: boolean
}

export default function AddToCartForm({ variants }: { variants: Variant[] }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(
    variants.find(v => v.in_stock)?.id ?? variants[0]?.id ?? ''
  )
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = variants.find(v => v.id === selectedId)
  const hasSizes = variants.some(v => v.size)

  async function handleAddToCart() {
    if (!selectedId || !selected?.in_stock) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant_id: selectedId, qty }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Could not add to cart')
        return
      }
      setAdded(true)
      router.refresh()
      setTimeout(() => setAdded(false), 3000)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 mt-auto">
      {/* Size selector — only shown when multiple variants */}
      {hasSizes && variants.length > 1 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2.5">Size</p>
          <div className="flex flex-wrap gap-2">
            {variants.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                disabled={!v.in_stock}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors min-w-[52px] ${
                  selectedId === v.id
                    ? 'bg-orange-600 border-orange-600 text-white'
                    : v.in_stock
                    ? 'bg-gray-900 border-gray-700 text-gray-300 hover:border-orange-500 hover:text-white'
                    : 'bg-gray-900/50 border-gray-800 text-gray-600 cursor-not-allowed line-through'
                }`}
              >
                {v.size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Single variant info (hat / one-size) */}
      {(!hasSizes || variants.length === 1) && selected && (
        <div className="flex gap-3 text-sm text-gray-500">
          {selected.color && <span>Color: <span className="text-gray-300">{selected.color}</span></span>}
          {selected.size && <span>Size: <span className="text-gray-300">{selected.size}</span></span>}
        </div>
      )}

      {/* Qty stepper */}
      <div className="flex items-center gap-3">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Qty</p>
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl px-2 py-1">
          <button
            onClick={() => setQty(q => Math.max(1, q - 1))}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors text-lg leading-none"
          >
            −
          </button>
          <span className="w-7 text-center text-sm font-bold text-white tabular-nums">{qty}</span>
          <button
            onClick={() => setQty(q => Math.min(10, q + 1))}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors text-lg leading-none"
          >
            +
          </button>
        </div>
      </div>

      {/* Add to cart */}
      <button
        onClick={handleAddToCart}
        disabled={!selected?.in_stock || loading || added}
        className={`py-3.5 px-6 rounded-xl font-bold text-base transition-all ${
          added
            ? 'bg-green-700 text-white cursor-default'
            : selected?.in_stock
            ? 'bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white disabled:opacity-60'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading
          ? 'Adding…'
          : added
          ? 'Added to Cart!'
          : !selected?.in_stock
          ? 'Out of Stock'
          : `Add to Cart · ${selected ? formatPrice(selected.retail_price_cents) : ''}`}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {added && (
        <a href="/cart" className="text-center text-sm text-orange-400 hover:text-orange-300 transition-colors font-medium">
          View Cart →
        </a>
      )}
    </div>
  )
}
