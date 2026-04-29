import type { WishlistStatus } from '@/lib/wishlist'
import { getStatusLabel } from '@/lib/wishlist'

const STATUS_STYLES: Record<WishlistStatus, string> = {
  considering: 'bg-gray-800 border-gray-700 text-gray-300',
  queued:      'bg-blue-950/40 border-blue-800/50 text-blue-400',
  testing:     'bg-green-950/40 border-green-800/50 text-green-400',
  reviewed:    'bg-orange-950/40 border-orange-800/50 text-orange-400',
  skipped:     'bg-gray-900 border-gray-800 text-gray-500',
}

interface Props {
  status: WishlistStatus
  className?: string
}

export function StatusBadge({ status, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[status]} ${className}`}>
      {status === 'testing' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
      {getStatusLabel(status)}
    </span>
  )
}
