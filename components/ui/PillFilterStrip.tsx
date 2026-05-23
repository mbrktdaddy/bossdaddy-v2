// Canonical class strings for active/inactive pill filter buttons.
// Apply to Link or button elements inside PillFilterStrip.
export const PILL_ACTIVE   = 'bg-accent text-white shadow-md shadow-stone-900/[0.05]'
export const PILL_INACTIVE = 'bg-surface text-prose-muted hover:bg-surface-raised hover:text-prose shadow-sm shadow-stone-900/[0.04]'
export const PILL_BASE     = 'shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-colors'

interface PillFilterStripProps {
  children: React.ReactNode
  className?: string
}

// Mobile-safe horizontal scroll container for category/tag filter pills.
// Handles the -mx-6 px-6 bleed-out pattern that prevents overflow clipping
// at the page level. Always use this instead of inline flex+overflow-x-auto.
export function PillFilterStrip({ children, className = '' }: PillFilterStripProps) {
  return (
    <div className={`flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1 ${className}`}>
      {children}
    </div>
  )
}
