'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Product } from '@/lib/products'
import { STORE_OPTIONS } from '@/lib/products'
import { ProductImageGallery } from '@/components/admin/ProductImageGallery'

const MediaPicker = dynamic(() => import('@/components/media/MediaPicker'), { ssr: false })

interface Props {
  product: Product | null
}

export function ProductForm({ product }: Props) {
  const router = useRouter()
  const isNew = !product

  const [slug, setSlug]                         = useState(product?.slug ?? '')
  const [name, setName]                         = useState(product?.name ?? '')
  const [asin, setAsin]                         = useState(product?.asin ?? '')
  const [store, setStore]                       = useState<string>(product?.store ?? 'amazon')
  const [customStoreName, setCustomStoreName]   = useState(product?.custom_store_name ?? '')
  const [affiliateUrl, setAffiliateUrl]         = useState(product?.affiliate_url ?? '')
  const [nonAffiliateUrl, setNonAffUrl]         = useState(product?.non_affiliate_url ?? '')
  const [imageUrl, setImageUrl]                 = useState(product?.image_url ?? '')

  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [deleting, setDeleting]     = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const newImageFileRef             = useRef<HTMLInputElement>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)

    const payload = {
      slug:              slug.trim().toLowerCase(),
      name:              name.trim(),
      asin:              asin.trim() || null,
      store,
      custom_store_name: store === 'other' ? (customStoreName.trim() || null) : null,
      affiliate_url:     affiliateUrl.trim() || null,
      non_affiliate_url: nonAffiliateUrl.trim() || null,
      image_url:         imageUrl.trim() || null,
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
      // On create, redirect to the edit page so the user lands on the
      // multi-upload gallery (which auto-tags every upload to this product).
      // On edit, return to the list as before.
      if (isNew && json.product?.id) {
        router.push(`/dashboard/admin/products/${json.product.id}`)
      } else {
        router.push('/dashboard/admin/products')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setBusy(false)
    }
  }

  async function handleNewImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/media', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Upload failed'); setUploading(false); return }
    setImageUrl(json.asset.url)
    setUploading(false)
    if (newImageFileRef.current) newImageFileRef.current.value = ''
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
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Store</label>
        <select
          value={store}
          onChange={(e) => setStore(e.target.value)}
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {STORE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {store === 'other' && (
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Store name</label>
          <input
            type="text"
            value={customStoreName}
            onChange={(e) => setCustomStoreName(e.target.value)}
            placeholder="e.g. REI, Costco, Target Canada"
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <p className="mt-1 text-xs text-gray-600">
            Used in the CTA button: &quot;Check Price at [store name]&quot;.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Affiliate URL</label>
        <input
          type="url"
          value={affiliateUrl}
          onChange={(e) => setAffiliateUrl(e.target.value)}
          placeholder="https://www.amazon.com/dp/... or affiliate link from any retailer"
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <p className="mt-1 text-xs text-gray-600">
          {store === 'amazon'
            ? 'Paste the SiteStripe "Text Only" URL — your associate tag should already be baked in.'
            : 'Your affiliate link from this retailer\'s program. Anchor gets rel="sponsored nofollow noopener" automatically.'
          }
        </p>
      </div>

      {store === 'amazon' && (
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">ASIN</label>
          <input
            type="text"
            value={asin}
            onChange={(e) => setAsin(e.target.value)}
            placeholder="B07XYZ1234"
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <p className="mt-1 text-xs text-gray-600">Amazon product ID — reference only, not used in the rendered link.</p>
        </div>
      )}

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
          Fallback used only when no affiliate URL is set. Rendered without <code>sponsored</code>/<code>nofollow</code>.
        </p>
      </div>

      {/* Image gallery — only available after the product is created */}
      {!isNew ? (
        <div className="space-y-3">
          <ProductImageGallery
            productId={product!.id}
            onPrimaryChange={(url) => setImageUrl(url ?? '')}
          />
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer hover:text-gray-400 transition-colors">Manual image URL override</summary>
            <div className="mt-2 space-y-1">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... paste a URL directly"
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-gray-600">
                Overrides the gallery primary. Useful for external image URLs (e.g. Amazon CDN).
                {store === 'amazon' && ' On the Amazon product page, right-click the main image → Copy image address.'}
              </p>
            </div>
          </details>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">Product Image</p>

          {/* Preview */}
          {imageUrl && (
            <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Product" className="w-full h-full object-contain p-2" />
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="absolute top-1 right-1 p-1 bg-gray-900/80 hover:bg-red-900/80 text-gray-400 hover:text-red-400 rounded transition-colors"
                title="Clear image"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-lg transition-colors"
            >
              Pick from library
            </button>
            <button
              type="button"
              onClick={() => newImageFileRef.current?.click()}
              disabled={uploading}
              className="text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-semibold rounded-lg transition-colors"
            >
              {uploading ? 'Uploading…' : '+ Upload'}
            </button>
          </div>
          <input
            ref={newImageFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleNewImageUpload}
          />

          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer hover:text-gray-400 transition-colors">Paste URL directly</summary>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="mt-2 w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </details>

          <p className="text-xs text-gray-600">
            After saving, you&apos;ll land on the multi-image gallery for this product — every image you upload there auto-tags to it.
          </p>

          {showPicker && (
            <MediaPicker
              onSelect={(url) => { setImageUrl(url); setShowPicker(false) }}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>
      )}

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
