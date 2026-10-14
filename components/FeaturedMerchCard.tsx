import Image from 'next/image'
import Link from 'next/link'
import { BagIcon } from '@/components/icons'
import { Badge } from '@/components/ui/Badge'
import { getMerchDisplayImage, formatPrice, type Merch } from '@/lib/merch'

interface Props {
  item: Pick<Merch, 'slug' | 'name' | 'image_url' | 'default_image_url' | 'price_cents' | 'status' | 'printful_sync_product_id' | 'external_url'>
  compact?: boolean
}

export function FeaturedMerchCard({ item, compact = false }: Props) {
  const displayImage = getMerchDisplayImage({ image_url: item.image_url, default_image_url: item.default_image_url })
  const isPrintful = item.printful_sync_product_id != null
  const href = isPrintful ? `/shop/${item.slug}` : (item.external_url ?? `/shop/${item.slug}`)
  const isExternal = !isPrintful && !!item.external_url

  const inner = (
    <>
      <div className="relative w-full aspect-square bg-surface-sunken border-b-[3px] border-chrome overflow-hidden">
        {displayImage ? (
          <Image
            src={displayImage}
            alt="" /* decorative: the link's text already names it — an alt here gets read twice */
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 208px, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BagIcon className="w-10 h-10 text-prose-faint" strokeWidth={1} aria-hidden />
          </div>
        )}
        {item.status === 'coming_soon' && (
          <Badge tone="neutral" size="sm" className="absolute top-2 left-2">Coming soon</Badge>
        )}
      </div>
      <div className={`flex-1 flex flex-col ${compact ? 'p-3' : 'p-4'}`}>
        <p className={`font-semibold text-prose leading-snug group-hover:text-accent-text-soft transition-colors line-clamp-2 ${compact ? 'text-xs' : 'text-sm'}`}>
          {item.name}
        </p>
        <p className={`text-prose font-bold tabular-nums mt-auto pt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
          {item.price_cents != null ? formatPrice(item.price_cents) : '—'}
        </p>
      </div>
    </>
  )

  const className = 'group flex h-full flex-col bg-surface rounded-xl overflow-hidden border border-soft hover:border-strong transition-colors'

  if (isExternal) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>
  }
  return <Link href={href} className={className}>{inner}</Link>
}
