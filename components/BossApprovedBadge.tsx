interface Props {
  size?: 'sm' | 'lg'
  variant?: 'page' | 'card'
}

const DISPLAY_FONT = { fontFamily: 'var(--font-display)' }

/**
 * Boss Approved stamp — three variants used across the site:
 *   - size='lg'                  → circular stamp on review detail pages
 *   - size='sm', variant='card'  → compact stamp overlay on review thumbnails
 *   - size='sm', variant='page'  → inline pill in sidebars / Quick Verdict
 *
 * Editorial-seal style: big "APPROVED" headline + small "by Boss Daddy"
 * byline. Orange-600 accent bg + white text + soft drop shadow + slight
 * rotation. The hierarchy makes the badge readable as a single bold
 * statement rather than three tiny stacked lines.
 */
export default function BossApprovedBadge({ size = 'sm', variant = 'page' }: Props) {

  // ── Large — circular stamp, used on review detail pages ─────────────────
  if (size === 'lg') {
    return (
      <div className="shrink-0 rotate-[-3deg]" aria-label="Boss Daddy Approved">
        <div className="w-28 h-28 rounded-full bg-orange-600 flex flex-col items-center justify-center shadow-xl shadow-black/40 ring-1 ring-orange-400/40">
          <span className="text-[24px] leading-none text-white font-bold mb-1">✓</span>
          <span className="text-base font-black tracking-[0.04em] uppercase leading-none text-white" style={DISPLAY_FONT}>
            Approved
          </span>
          <span className="text-[8px] font-bold tracking-[0.18em] uppercase leading-none text-orange-200 mt-1" style={DISPLAY_FONT}>
            by Boss Daddy
          </span>
        </div>
      </div>
    )
  }

  // ── Small card overlay — compact stamp on thumbnail images ───────────────
  if (variant === 'card') {
    return (
      <div className="rotate-[-3deg]" aria-label="Boss Daddy Approved">
        <div className="flex flex-col items-center justify-center px-3 py-2 bg-orange-600 rounded-lg shadow-lg shadow-black/50 ring-1 ring-orange-400/40">
          <span className="text-[12px] leading-none text-white font-bold">✓</span>
          <span className="text-[10px] font-black tracking-[0.04em] uppercase leading-none text-white mt-0.5" style={DISPLAY_FONT}>
            Approved
          </span>
          <span className="text-[6px] font-bold tracking-[0.18em] uppercase leading-none text-orange-200 mt-0.5" style={DISPLAY_FONT}>
            by Boss Daddy
          </span>
        </div>
      </div>
    )
  }

  // ── Small page — inline badge in listing/sidebar contexts ────────────────
  return (
    <div className="rotate-[-2deg] shrink-0" aria-label="Boss Daddy Approved">
      <div className="flex flex-col items-center justify-center px-3 py-1.5 bg-orange-600 rounded-lg shadow-md shadow-black/40 ring-1 ring-orange-400/40">
        <span className="text-xs leading-none text-white font-bold">✓</span>
        <span className="text-[11px] font-black tracking-[0.04em] uppercase leading-none text-white mt-0.5" style={DISPLAY_FONT}>
          Approved
        </span>
        <span className="text-[7px] font-bold tracking-[0.18em] uppercase leading-none text-orange-200 mt-0.5" style={DISPLAY_FONT}>
          by Boss Daddy
        </span>
      </div>
    </div>
  )
}
