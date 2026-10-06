import type { WishlistStatus } from '@/lib/wishlist'
import { getStatusLabel } from '@/lib/wishlist'
import type { ProductStatus } from '@/lib/products'
import { Badge, type BadgeTone } from '@/components/ui/Badge'

// Shared with the admin products list (ProductStatus = WishlistStatus + catalog + radar + archived).
export const BENCH_STATUS_TONE: Record<ProductStatus, BadgeTone> = {
  catalog:     'neutral',
  radar:       'warn',
  queued:      'info',
  testing:     'success',
  reviewed:    'accent',
  passed:      'muted',
  archived:    'danger',
}

interface Props {
  status: WishlistStatus
  className?: string
}

export function StatusBadge({ status, className = '' }: Props) {
  return (
    <Badge tone={BENCH_STATUS_TONE[status]} pulse={status === 'testing'} className={className}>
      {getStatusLabel(status)}
    </Badge>
  )
}
