import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'
import sharp from 'sharp'

// Node runtime (not edge) so `sharp` can run — it converts the hero from WebP
// (which Satori/ImageResponse can't read) to PNG and crops it to exactly
// 1200×630, killing both the format and aspect-ratio problems in one step.
export const runtime = 'nodejs'

const OG_W = 1200
const OG_H = 630

// Only our own images may be composited — never an arbitrary URL (no open proxy).
// Allowed: Supabase storage public objects (hero/product images) and our own
// site-origin static assets under /images (e.g. the homepage workshop hero).
function isOwnImageUrl(url: string): boolean {
  const storage = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (storage && url.startsWith(`${storage}/storage/v1/object/public/`)) return true
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (site && url.startsWith(`${site}/images/`)) return true
  return false
}

// Fetch the hero and return a 1200×630 PNG data URI, or null on any failure
// (missing/invalid url, fetch error, decode error) so the caller falls back to
// the text card rather than emitting a broken image.
async function heroDataUri(rawUrl: string | null): Promise<string | null> {
  if (!rawUrl) return null
  const url = rawUrl.split('?')[0]
  if (!isOwnImageUrl(url)) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const input = Buffer.from(await res.arrayBuffer())
    // JPEG (not PNG): photos compress ~8× smaller, keeping the base64 data-URI
    // that Satori decodes lightweight. The final card is re-encoded by ImageResponse.
    const jpeg = await sharp(input)
      .resize(OG_W, OG_H, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') ?? 'Boss Daddy Life'
  const type = searchParams.get('type') ?? 'review'
  const category = searchParams.get('category') ?? ''
  const cta = searchParams.get('cta') ?? ''

  // 'site' (and any unknown type) shows no content-type badge — used by the
  // homepage and section cards.
  const typeLabel = type === 'guide' || type === 'article' ? 'ARTICLE' : type === 'review' ? 'REVIEW' : ''
  const categoryLabel = category
    ? category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : ''

  const bg = await heroDataUri(searchParams.get('img'))

  const cacheHeaders = {
    'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
  }

  const Brand = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: '#f48a4a', fontWeight: 900, fontSize: '22px', letterSpacing: '-0.5px' }}>BOSS</span>
      <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '22px', letterSpacing: '-0.5px' }}>DADDY LIFE</span>
    </div>
  )

  const Badges = (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
      {typeLabel && (
        <span style={{ backgroundColor: '#CC5500', color: '#ffffff', fontSize: '13px', fontWeight: 700, padding: '6px 14px', borderRadius: '100px', letterSpacing: '0.08em' }}>
          {typeLabel}
        </span>
      )}
      {categoryLabel && (
        <span style={{ backgroundColor: 'rgba(255,255,255,0.14)', color: '#f3f4f6', fontSize: '13px', fontWeight: 600, padding: '6px 14px', borderRadius: '100px' }}>
          {categoryLabel}
        </span>
      )}
    </div>
  )

  const BottomBar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '24px' }}>
      <span style={{ color: '#d1d5db', fontSize: '16px' }}>bossdaddylife.com</span>
      {cta ? (
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#CC5500', color: '#ffffff', fontSize: '18px', fontWeight: 700, padding: '12px 24px', borderRadius: '100px' }}>
          {cta} →
        </div>
      ) : (
        <span style={{ color: '#f48a4a', fontSize: '15px', fontWeight: 700 }}>Dad-Tested · Honestly Rated</span>
      )}
    </div>
  )

  const Title = (
    <div style={{ color: '#ffffff', fontSize: title.length > 60 ? '46px' : '58px', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-1px', textShadow: bg ? '0 2px 24px rgba(0,0,0,0.6)' : 'none', display: 'flex' }}>
      {title}
    </div>
  )

  const element = bg ? (
    // Photo card — hero as full-bleed background + dark scrim for legibility.
    <div style={{ width: `${OG_W}px`, height: `${OG_H}px`, display: 'flex', position: 'relative', fontFamily: 'Arial, sans-serif' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bg} alt="" width={OG_W} height={OG_H} style={{ position: 'absolute', top: 0, left: 0, width: `${OG_W}px`, height: `${OG_H}px`, objectFit: 'cover' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(180deg, rgba(10,10,10,0.30) 0%, rgba(10,10,10,0.35) 45%, rgba(10,10,10,0.92) 100%)' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '56px' }}>
        {Brand}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {Badges}
          {Title}
          {BottomBar}
        </div>
      </div>
    </div>
  ) : (
    // Text card — the branded fallback when there's no hero (or the fetch failed).
    <div style={{ width: `${OG_W}px`, height: `${OG_H}px`, display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0a', padding: '60px', fontFamily: 'Arial, sans-serif', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at top left, rgba(204, 85, 0, 0.15) 0%, transparent 60%)' }} />
      <div style={{ display: 'flex', marginBottom: '40px' }}>{Brand}</div>
      {Badges}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>{Title}</div>
      <div style={{ borderTop: '1px solid #1f1f1f' }}>{BottomBar}</div>
    </div>
  )

  return new ImageResponse(element, { width: OG_W, height: OG_H, headers: cacheHeaders })
}
