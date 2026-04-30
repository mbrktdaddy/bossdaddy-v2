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
 * Style: orange-600 accent bg + white text + soft drop shadow + slight
 * rotation. Uses the design system's shadow skin (no borders, cast shadow
 * for elevation) and font-display for type consistency with the rest of
 * the site. The rotation preserves the badge's "stamp" identity.
 */
export default function BossApprovedBadge({ size = 'sm', variant = 'page' }: Props) {

  // ── Large — circular stamp, used on review detail pages ─────────────────
  if (size === 'lg') {
    return (
      <div
        className="shrink-0 rotate-[-3deg]"
        aria-label="Boss Daddy Approved"
      >
        <div className="w-28 h-28 rounded-full bg-orange-600 flex flex-col items-center justify-center gap-0.5 shadow-xl shadow-black/40 ring-1 ring-orange-400/40">
          <span
            className="text-[8px] font-black tracking-[0.22em] uppercase leading-none text-white"
            style={DISPLAY_FONT}
          >
            BOSS DADDY
          </span>
          <span className="text-[28px] leading-none text-white font-bold">✓</span>
          <span
            className="text-[8px] font-black tracking-[0.22em] uppercase leading-none text-white"
            style={DISPLAY_FONT}
          >
            APPROVED
          </span>
        </div>
      </div>
    )
  }

  // ── Small card overlay — compact stamp on thumbnail images ───────────────
  if (variant === 'card') {
    return (
      <div
        className="rotate-[-3deg]"
        aria-label="Boss Daddy Approved"
      >
        <div className="flex flex-col items-center justify-center px-2.5 py-1.5 bg-orange-600 rounded-lg shadow-lg shadow-black/50 ring-1 ring-orange-400/40">
          <span
            className="text-[6px] font-black tracking-[0.22em] uppercase leading-none text-white"
            style={DISPLAY_FONT}
          >
            BOSS DADDY
          </span>
          <span className="text-[11px] leading-none my-0.5 text-white font-bold">✓</span>
          <span
            className="text-[6px] font-black tracking-[0.22em] uppercase leading-none text-white"
            style={DISPLAY_FONT}
          >
            APPROVED
          </span>
        </div>
      </div>
    )
  }

  // ── Small page — inline badge in listing/sidebar contexts ────────────────
  return (
    <div
      className="rotate-[-2deg] shrink-0"
      aria-label="Boss Daddy Approved"
    >
      <div className="flex flex-col items-center justify-center px-2.5 py-1 bg-orange-600 rounded-lg shadow-md shadow-black/40 ring-1 ring-orange-400/40">
        <span
          className="text-[7px] font-black tracking-[0.2em] uppercase leading-none text-white"
          style={DISPLAY_FONT}
        >
          BOSS DADDY
        </span>
        <span className="text-[10px] leading-none my-0.5 text-white font-bold">✓</span>
        <span
          className="text-[7px] font-black tracking-[0.2em] uppercase leading-none text-white"
          style={DISPLAY_FONT}
        >
          APPROVED
        </span>
      </div>
    </div>
  )
}
