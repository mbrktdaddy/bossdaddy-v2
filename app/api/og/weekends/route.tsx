// Dynamic Open Graph image for /tools/weekends-until.
//
// Renders the number-first share card per locked decision (number-only
// in v1; photo overlay deferred to v1.5). Reads query params:
//
//   ?n=612            number to display
//   &unit=weekends    weekends | bedtimes
//   &for=M            kid first-INITIAL only (privacy default)
//
// Per docs/dad-tools-plan.md §4.2 + §9: share cards show first-initial
// only by default; full name display is opt-in, not opt-out.

import { ImageResponse } from 'next/og'

export const dynamic = 'force-dynamic'

const ORANGE   = '#CC5500'
const SURFACE  = '#fafafa'
const PROSE    = '#27272a'
const FAINT    = '#71717a'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const nRaw  = searchParams.get('n') ?? ''
  const unit  = (searchParams.get('unit') ?? 'weekends').toLowerCase()
  const initialRaw = searchParams.get('for') ?? ''
  const initial = initialRaw.trim().charAt(0).toUpperCase() || null

  const n = nRaw && /^[0-9]{1,5}$/.test(nRaw)
    ? Number.parseInt(nRaw, 10).toLocaleString()
    : '—'

  const unitWord =
    unit === 'bedtimes'
      ? (n === '1' ? 'bedtime' : 'bedtimes')
      : (n === '1' ? 'weekend' : 'weekends')

  const subline = initial
    ? `${unitWord} left with ${initial}.`
    : `${unitWord} left.`

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: SURFACE,
          padding: '72px 80px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: ORANGE,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          Weekends Until · Boss Daddy
        </div>

        {/* The number — the entire reason for the card */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 260,
              fontWeight: 900,
              color: ORANGE,
              lineHeight: 0.9,
              letterSpacing: '-0.04em',
              display: 'flex',
            }}
          >
            {n}
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: PROSE,
              marginTop: 24,
              display: 'flex',
            }}
          >
            {subline}
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 500,
              color: FAINT,
              marginTop: 8,
              display: 'flex',
            }}
          >
            Make them count.
          </div>
        </div>

        {/* Footer wordmark — children set their own colors. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: PROSE,
            }}
          >
            BOSS DADDY
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: ORANGE,
              border: `1px solid ${ORANGE}`,
              borderRadius: 9999,
              padding: '4px 12px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            Tools · Beta
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              fontSize: 20,
              color: FAINT,
              fontWeight: 500,
            }}
          >
            bossdaddylife.com/tools/weekends-until
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}
