'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Product } from '@/lib/products'

interface Props {
  product: Product | null
}

export function ProductForm({ product }: Props) {
  const router = useRouter()
  const isNew = !product

  const [slug, setSlug]                     = useState(product?.slug ?? '')
  const [name, setName]                     = useState(product?.name ?? '')
  const [asin, setAsin]                     = useState(product?.asin ?? '')
  const [amazonUrl, setAmazonUrl]           = useState(product?.amazon_url ?? '')
  const [nonAffiliateUrl, setNonAffUrl]     = useState(product?.non_affiliate_url ?? '')
  const [imageUrl, setImageUrl]             = useState(product?.image_url ?? '')

  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)

    const payload = {
      slug: slug.trim().toLowerCase(),
      name: name.trim(),
      asin: asin.trim() || null,
      amazon_url: amazonUrl.trim() || null,
      non_affiliate_url: nonAffiliateUrl.trim() || null,
      image_url: imageUrl.trim() || null,
    }

    try {
      const res = await fetch(
        isNew ? '/api/admin/products' : `/api/admin/products/${product!.id}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      router.push('/dashboard/admin/products')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!product) return
    if (!confirm(`Delete product "${product.name}"? Any [[BUY:${product.slug}]] tokens in future reviews will render as "link missing" until fixed.`)) return
    setDeleting(true); setError(null)
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Delete failed')
      }
      router.push('/dashboard/admin/products')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">
          Slug <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          pattern="[a-z0-9-]+"
          placeholder="enfamil-enspire"
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <p className="mt-1 text-xs text-gray-600">
          Used in tokens: <code className="text-orange-400">[[BUY:{slug || 'your-slug'}]]</code>. Lowercase letters, numbers, hyphens only.
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1.5">
          Product name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enfamil Enspire"
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <p className="mt-1 text-xs text-gray-600">
          Becomes the link text: &ldquo;{name || 'Product name'} on Amazon&rdquo;.
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Amazon URL</label>
        <input
          type="url"
          value={amazonUrl}
          onChange={(e) => setAmazonUrl(e.target.value)}
          placeholder="https://www.amazon.com/dp/..."
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <p className="mt-1 text-xs text-gray-600">
          Paste the SiteStripe &ldquo;Text Only&rdquo; URL — your associate tag should already be baked in. Anchor gets <code className="text-orange-400">rel=&quot;sponsored nofollow noopener&quot;</code>.
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1.5">ASIN</label>
        <input
          type="text"
          value={asin}
          onChange={(e) => setAsin(e.target.value)}
          placeholder="B07XYZ1234"
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <p className="mt-1 text-xs text-gray-600">Reference only — not used in the rendered link.</p>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Non-affiliate URL</label>
        <input
          type="url"
          value={nonAffiliateUrl}
          onChange={(e) => setNonAffUrl(e.target.value)}
          placeholder="https://manufacturer.com/product"
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <p className="mt-1 text-xs text-gray-600">
          Fallback used only when no Amazon URL is set. Rendered without <code>sponsored</code>/<code>nofollow</code>.
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Image URL</label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <p className="mt-1 text-xs text-gray-600">Optional — reserved for future use.</p>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy || !slug.trim() || !name.trim()}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {busy ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-5 py-2.5 text-red-400 hover:text-red-300 text-sm transition-colors disabled:opacity-40"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  )
}
