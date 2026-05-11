import Image from 'next/image'
import Link from 'next/link'
import { getMerchDisplayImage, formatPrice, type Merch } from '@/lib/merch'

interface Props {
  item: Pick<Merch, 'slug' | 'name' | 'image_url' | 'default_image_url' | 'price_cents' | 'status' | 'printful_sync_product_id' | 'external_url'>
  compact?: boolean
}

export function FeaturedMerchCard({ item, compact = false }: Props) {
  const displayImage = getMerchDisplayImage({ image_url: item.image_url, default_image_url: item.default_image_url })
  const isPrintful = item.printful_sync_product_id != null
  const href = isPrintful ? `/gear/${item.slug}` : (item.external_url ?? `/gear/${item.slug}`)
  const isExternal = !isPrintful && !!item.external_url

  const inner = (
    <>
      <div className="relative w-full aspect-square bg-gray-800/40 overflow-hidden">
        {displayImage ? (
          <Image
            src={displayImage}
            alt={item.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 208px, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-30">👕</span>
          </div>
        )}
        {item.status === 'coming_soon' && (
          <div className="absolute top-2 left-2 bg-orange-950/90 backdrop-blur-sm px-2 py-0.5 rounded-full">
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Coming Soon</p>
          </div>
        )}
      </div>
      <div className={compact ? 'p-3' : 'p-4'}>
        <p className={`font-semibold text-white leading-snug group-hover:text-orange-400 transition-colors line-clamp-2 ${compact ? 'text-xs' : 'text-sm'}`}>
          {item.name}
        </p>
        <p className={`text-orange-500 font-bold mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
          {item.price_cents != null ? formatPrice(item.price_cents) : 'Shop Now'}
        </p>
      </div>
    </>
  )

  const className = 'group flex flex-col bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-200'

  if (isExternal) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>
  }
  return <Link href={href} className={className}>{inner}</Link>
}
