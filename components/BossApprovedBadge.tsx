interface Props {
  size?: 'sm' | 'lg'
  variant?: 'page' | 'card'
}

const DISPLAY_FONT = { fontFamily: 'var(--font-display)' }
const CREAM        = '#EDE6D3'
const CREAM_MUTED  = '#C9BFA8'
const ORANGE_DARK  = '#3d1a00'

export default function BossApprovedBadge({ size = 'sm', variant = 'page' }: Props) {

  // ── Large — circular stamp, used on review detail pages ─────────────────
  if (size === 'lg') {
    return (
      <div
        className="shrink-0 rotate-[-3deg]"
        style={{ filter: 'drop-shadow(0 2px 14px rgba(204,85,0,0.55))' }}
        aria-label="Boss Daddy Approved"
      >
        <div
          className="w-28 h-28 rounded-full bg-orange-950 flex flex-col items-center justify-center gap-0.5"
          style={{
            border: `2px solid ${CREAM_MUTED}`,
            boxShadow: `0 0 0 5px ${ORANGE_DARK}, 0 0 0 7px ${CREAM_MUTED}`,
          }}
        >
          <span
            className="text-[8px] font-black tracking-[0.22em] uppercase leading-none"
            style={{ color: CREAM, ...DISPLAY_FONT }}
          >
            BOSS DADDY
          </span>
          <span className="text-[28px] leading-none" style={{ color: '#e87030' }}>✓</span>
          <span
            className="text-[8px] font-black tracking-[0.22em] uppercase leading-none"
            style={{ color: CREAM, ...DISPLAY_FONT }}
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
        style={{ filter: 'drop-shadow(0 1px 8px rgba(204,85,0,0.65))' }}
        aria-label="Boss Daddy Approved"
      >
        <div
          className="flex flex-col items-center justify-center px-2 py-1.5 bg-orange-950 rounded"
          style={{
            border: `1px solid ${CREAM_MUTED}`,
            boxShadow: `0 0 0 2.5px ${ORANGE_DARK}, 0 0 0 4px ${CREAM_MUTED}`,
          }}
        >
          <span
            className="text-[6px] font-black tracking-[0.22em] uppercase leading-none"
            style={{ color: CREAM, ...DISPLAY_FONT }}
          >
            BOSS DADDY
          </span>
          <span className="text-[11px] leading-none my-0.5" style={{ color: '#e87030' }}>✓</span>
          <span
            className="text-[6px] font-black tracking-[0.22em] uppercase leading-none"
            style={{ color: CREAM, ...DISPLAY_FONT }}
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
      style={{ filter: 'drop-shadow(0 1px 6px rgba(204,85,0,0.4))' }}
      aria-label="Boss Daddy Approved"
    >
      <div
        className="flex flex-col items-center justify-center px-2 py-1 bg-orange-950/60 rounded"
        style={{
          border: `1px solid ${CREAM_MUTED}`,
          boxShadow: `0 0 0 2px ${ORANGE_DARK}, 0 0 0 3.5px ${CREAM_MUTED}`,
        }}
      >
        <span
          className="text-[7px] font-black tracking-[0.2em] uppercase leading-none"
          style={{ color: CREAM, ...DISPLAY_FONT }}
        >
          BOSS DADDY
        </span>
        <span className="text-[10px] leading-none my-0.5" style={{ color: '#e87030' }}>✓</span>
        <span
          className="text-[7px] font-black tracking-[0.2em] uppercase leading-none"
          style={{ color: CREAM, ...DISPLAY_FONT }}
        >
          APPROVED
        </span>
      </div>
    </div>
  )
}
