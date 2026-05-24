import Image from 'next/image'
import type { Product } from '@/lib/products'
import { getStoreLabel } from '@/lib/products'
import RatingScore from './RatingScore'

interface Props {
  product: Pick<Product, 'slug' | 'name' | 'affiliate_url' | 'non_affiliate_url' | 'image_url' | 'store' | 'custom_store_name'>
  rating?: number
  variant?: 'prominent' | 'final'
}

export default function ProductCtaCard({ product, rating, variant = 'prominent' }: Props) {
  const href = product.affiliate_url ? `/go/${product.slug}` : product.non_affiliate_url
  if (!href) return null

  const isAffiliate = Boolean(product.affiliate_url)
  const isAmazon = isAffiliate && product.store === 'amazon'
  const rel = isAffiliate ? 'sponsored nofollow noopener' : 'noopener'
  const storeName = getStoreLabel(product.store, product.custom_store_name)
  const buttonLabel = isAffiliate ? `Check Price at ${storeName}` : `View ${product.name}`
  const heading = variant === 'final' ? 'Ready to grab one?' : 'Get This Product'

  return (
    <aside
      data-product-cta
      className="my-8 bg-accent-tint border border-strong rounded-xl p-5 sm:p-6 shadow-xl shadow-black/30"
      aria-label="Product offer"
    >
      <p className="text-xs text-accent-text-soft uppercase tracking-widest font-semibold mb-3">
        {heading}
      </p>

      <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
        {product.image_url && (
          <div className="relative w-full sm:w-32 h-32 shrink-0 rounded-xl overflow-hidden bg-surface-sunken">
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-contain p-2"
              sizes="(max-width: 640px) 100vw, 128px"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-black text-lg sm:text-xl text-prose leading-tight mb-2">
            {product.name}
          </p>
          {typeof rating === 'number' && (
            <div className="mb-4">
              <RatingScore rating={rating} size="sm" />
            </div>
          )}
          <a
            href={href}
            target="_blank"
            rel={rel}
            data-product-slug={product.slug}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl transition-colors min-h-[44px] w-full sm:w-auto"
          >
            {buttonLabel}
          </a>
          {isAmazon && (
            <p className="mt-2 text-[11px] text-prose-faint">
              As an Amazon Associate I earn from qualifying purchases.
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}
