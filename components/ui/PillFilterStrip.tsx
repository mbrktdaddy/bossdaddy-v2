// Canonical class strings for active/inactive filter chips.
// Apply to Link or button elements inside PillFilterStrip.
//
// Hard Goods (2026-10-14, brand-guide §6/§10.1): the filter "pill" is a square
// CHIP — 2px border in the text colour, uppercase Montserrat, 4px corners,
// black fill when active. It is the same stamp as the outline button, one size
// down. The rounded-full pill was the SaaS tell on the white page; the approved
// mockup ran square chips. prose/background invert inside dark zones by
// themselves, so the pair reads right on both canvases.
export const PILL_ACTIVE   = 'bg-prose text-background border-prose'
export const PILL_INACTIVE = 'bg-transparent text-prose border-prose hover:bg-prose hover:text-background'
export const PILL_BASE     = 'shrink-0 inline-flex items-center gap-2 px-3.5 min-h-[44px] rounded-md border-2 font-display font-extrabold text-[11px] uppercase tracking-[0.1em] whitespace-nowrap transition-colors'

interface PillFilterStripProps {
  children: React.ReactNode
  className?: string
}

// Mobile-safe horizontal scroll container for category/tag filter chips.
// Handles the -mx-6 px-6 bleed-out pattern that prevents overflow clipping
// at the page level. Always use this instead of inline flex+overflow-x-auto.
export function PillFilterStrip({ children, className = '' }: PillFilterStripProps) {
  return (
    <div className={`flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1 ${className}`}>
      {children}
    </div>
  )
}
