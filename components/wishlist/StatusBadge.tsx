import type { WishlistStatus } from '@/lib/wishlist'
import { getStatusLabel } from '@/lib/wishlist'
import { Badge, type BadgeTone } from '@/components/ui/Badge'

// Shared with the admin products list (ProductStatus = WishlistStatus + archived).
export const BENCH_STATUS_TONE: Record<WishlistStatus | 'archived', BadgeTone> = {
  considering: 'neutral',
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
