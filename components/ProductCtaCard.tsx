import Image from 'next/image'
import type { Product } from '@/lib/products'
import RatingScore from './RatingScore'

interface Props {
  product: Pick<Product, 'slug' | 'name' | 'amazon_url' | 'non_affiliate_url' | 'image_url'>
  rating?: number
  variant?: 'prominent' | 'final'
}

export default function ProductCtaCard({ product, rating, variant = 'prominent' }: Props) {
  const href = product.amazon_url ?? product.non_affiliate_url
  if (!href) return null

  const isAmazon = Boolean(product.amazon_url)
  const rel = isAmazon ? 'sponsored nofollow noopener' : 'noopener'
  const buttonLabel = isAmazon ? 'Check Price on Amazon' : `View ${product.name}`
  const heading = variant === 'final' ? 'Ready to grab one?' : 'Get This Product'

  return (
    <aside
      className="my-8 bg-gradient-to-br from-orange-950/60 to-gray-900 border border-orange-900/50 rounded-2xl p-5 sm:p-6"
      aria-label="Product offer"
    >
      <p className="text-xs text-orange-400 uppercase tracking-widest font-semibold mb-3">
        {heading}
      </p>

      <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
        {product.image_url && (
          <div className="relative w-full sm:w-32 h-32 shrink-0 rounded-xl overflow-hidden bg-gray-950 border border-gray-800">
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
          <p className="font-black text-lg sm:text-xl text-white leading-tight mb-2">
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
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-colors min-h-[44px] w-full sm:w-auto"
          >
            {buttonLabel}
            <span aria-hidden="true">→</span>
          </a>
          {isAmazon && (
            <p className="mt-2 text-[11px] text-gray-500">
              As an Amazon Associate I earn from qualifying purchases.
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}
