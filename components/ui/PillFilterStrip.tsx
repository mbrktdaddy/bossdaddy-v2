// Canonical class strings for active/inactive pill filter buttons.
// Apply to Link or button elements inside PillFilterStrip.
//
// Dark editorial: active pill uses prose-on-background (auto-flips
// per scope — light chip on dark canvas, dark chip on .bd-on-paper
// cream sections). Idle pill is a ghosted outline with hover→copper.
export const PILL_ACTIVE   = 'bg-prose text-background border border-prose shadow-sm shadow-stone-950/40'
export const PILL_INACTIVE = 'bg-transparent text-prose-muted border border-strong hover:border-copper hover:text-prose'
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
