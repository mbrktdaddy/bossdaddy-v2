import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') ?? 'Boss Daddy Life'
  const type = searchParams.get('type') ?? 'review'
  const category = searchParams.get('category') ?? ''

  const typeLabel = type === 'guide' ? 'ARTICLE' : 'REVIEW'
  const categoryLabel = category
    ? category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0a0a0a',
          padding: '60px',
          fontFamily: 'Arial, sans-serif',
          position: 'relative',
        }}
      >
        {/* Background gradient */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(ellipse at top left, rgba(204, 85, 0, 0.15) 0%, transparent 60%)',
          }}
        />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '40px' }}>
          <span style={{ color: '#CC5500', fontWeight: 900, fontSize: '22px', letterSpacing: '-0.5px' }}>
            BOSS
          </span>
          <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '22px', letterSpacing: '-0.5px' }}>
            DADDY LIFE
          </span>
        </div>

        {/* Type + Category badges */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
          <span
            style={{
              backgroundColor: '#CC5500',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: '100px',
              letterSpacing: '0.08em',
            }}
          >
            {typeLabel}
          </span>
          {categoryLabel && (
            <span
              style={{
                backgroundColor: '#1f1f1f',
                color: '#9ca3af',
                fontSize: '13px',
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: '100px',
                border: '1px solid #2a2a2a',
              }}
            >
              {categoryLabel}
            </span>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            color: '#ffffff',
            fontSize: title.length > 60 ? '42px' : '52px',
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: '-1px',
            flex: 1,
            display: 'flex',
            alignItems: 'flex-start',
          }}
        >
          {title}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '28px',
            borderTop: '1px solid #1f1f1f',
          }}
        >
          <span style={{ color: '#6b7280', fontSize: '16px' }}>bossdaddylife.com</span>
          <span style={{ color: '#CC5500', fontSize: '15px', fontWeight: 700 }}>
            Dad-Tested · Honestly Rated
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  )
}
