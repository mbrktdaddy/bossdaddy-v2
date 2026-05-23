// Canonical class strings for active/inactive pill filter buttons.
// Apply to Link or button elements inside PillFilterStrip.
// Heritage Pro: active pill is the architectural dark pill (drama
// charcoal + cream text), idle pill is white with a confident hairline
// that strengthens on hover. Reserves the orange action color for true
// CTAs (buttons), not selection state.
export const PILL_ACTIVE   = 'bg-drama text-stone-50 border border-drama shadow-sm shadow-stone-900/20'
export const PILL_INACTIVE = 'bg-white text-prose border border-strong hover:border-prose hover:bg-stone-50'
export const PILL_BASE     = 'shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors'

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
