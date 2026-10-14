interface Props {
  size?: 'sm' | 'lg'
  variant?: 'page' | 'card'
}

/**
 * Boss Approved mark — three variants used across the site:
 *   - size='lg'                  → the round seal on review detail pages (the
 *                                  one brand moment that keeps a circle)
 *   - size='sm', variant='card'  → the square tag over review thumbnails
 *   - size='sm', variant='page'  → the inline chip in sidebars / Quick Verdict
 *
 * Hard Goods (2026-10-14, brand-guide §4/§6): flat. The drop shadows, rings
 * and the −3° "stamp" rotation are gone — a solid orange block with white
 * Montserrat caps is the mark, the same recipe as the status chips, so one
 * image carries at most ONE square tag (never an orange pill over a photo).
 */
export default function BossApprovedBadge({ size = 'sm', variant = 'page' }: Props) {

  // ── Large — the round seal, review detail header only ───────────────────
  if (size === 'lg') {
    return (
      <div className="shrink-0" aria-label="Boss Daddy Approved">
        <div className="w-28 h-28 rounded-full bg-accent flex flex-col items-center justify-center text-white">
          <span className="text-[24px] leading-none font-bold mb-1" aria-hidden>✓</span>
          <span className="font-display text-base font-black tracking-[0.04em] uppercase leading-none">
            Approved
          </span>
          <span className="font-display text-[8px] font-bold tracking-[0.18em] uppercase leading-none text-white/80 mt-1">
            by Boss Daddy
          </span>
        </div>
      </div>
    )
  }

  // ── Small card overlay — the square tag on thumbnail images ─────────────
  if (variant === 'card') {
    return (
      <span
        aria-label="Boss Daddy Approved"
        className="inline-flex items-center gap-1 bg-accent text-white rounded-sm px-2 py-1.5 font-display font-black text-[10px] uppercase tracking-[0.14em] leading-none"
      >
        <span aria-hidden>✓</span>
        Approved
      </span>
    )
  }

  // ── Small page — inline chip in listing / sidebar contexts ──────────────
  return (
    <span
      aria-label="Boss Daddy Approved"
      className="inline-flex items-center gap-1.5 shrink-0 bg-accent text-white rounded-sm px-2.5 py-1.5 font-display font-black text-[11px] uppercase tracking-[0.14em] leading-none"
    >
      <span aria-hidden>✓</span>
      Boss Approved
    </span>
  )
}
