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

// The same chip for options that are SENTENCES — the Boss's suggestion chips,
// long kid/goal names: it wraps (no nowrap/shrink-0), and it's sentence case at
// body size, because a full question in 11px tracked caps is unreadable. Same
// square 2px edge, same 44px floor, same PILL_ACTIVE / PILL_INACTIVE colours.
// Lay them out in a `flex flex-wrap gap-2` row, never a scroller.
export const PILL_WRAP     = 'inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-md border-2 text-sm font-semibold text-left leading-snug transition-colors'

interface PillFilterStripProps {
  children: React.ReactNode
  /**
   * The parent column's horizontal padding, so the strip bleeds exactly to the
   * screen edge: 6 for the listing pages (`px-6`), 4 for the tool/app pages
   * (`px-4`) — those hand-rolled their own scrollers because this only bled 6.
   */
  bleed?: 4 | 6
  className?: string
}

const BLEED = { 4: '-mx-4 px-4', 6: '-mx-6 px-6' } as const

// Mobile-safe horizontal scroll container for category/tag filter chips.
// Handles the bleed-out pattern that prevents overflow clipping at the page
// level. Always use this instead of inline flex+overflow-x-auto.
export function PillFilterStrip({ children, bleed = 6, className = '' }: PillFilterStripProps) {
  return (
    <div className={`flex gap-2 overflow-x-auto scrollbar-hide ${BLEED[bleed]} pb-1 ${className}`}>
      {children}
    </div>
  )
}
