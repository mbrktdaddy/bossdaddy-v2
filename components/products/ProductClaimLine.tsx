import { productClaims, type ProductAcquisition, type ProductStatus } from '@/lib/products'
import { Badge } from '@/components/ui/Badge'
import { BENCH_STATUS_TONE } from '@/components/wishlist/StatusBadge'

interface Props {
  product: {
    status?: string | null
    acquisition?: string | null
    provided_by?: string | null
    brand?: string | null
  }
  className?: string
}

/**
 * What a showcased product card says about the product — and only what the
 * operator set (brand-guide §1.9): its stage (Up Next / Testing Now / Reviewed),
 * "Bought it", and the legally required line for a provided or loaned unit.
 * Renders nothing for a plain showcased product: showcasing claims nothing, so
 * there is no default "not tested" or "owner pick" chip.
 */
export function ProductClaimLine({ product, className = '' }: Props) {
  const claims = productClaims({
    status:      (product.status ?? 'catalog') as ProductStatus,
    acquisition: (product.acquisition ?? null) as ProductAcquisition | null,
    provided_by: product.provided_by ?? null,
    brand:       product.brand ?? null,
  })
  if (!claims.stage && !claims.bought && !claims.disclosure) return null

  return (
    <div className={`mb-2 ${className}`}>
      {(claims.stage || claims.bought) && (
        <div className="flex flex-wrap gap-2">
          {claims.stage && (
            <Badge tone={BENCH_STATUS_TONE[claims.stage.status]} pulse={claims.stage.status === 'testing'}>
              {claims.stage.label}
            </Badge>
          )}
          {claims.bought && <Badge tone="neutral">Bought it</Badge>}
        </div>
      )}
      {claims.disclosure && (
        <p className={`text-xs text-prose-faint italic ${claims.stage || claims.bought ? 'mt-1.5' : ''}`}>{claims.disclosure}</p>
      )}
    </div>
  )
}
