import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'
import sharp from 'sharp'
import { isOwnImageUrl } from '@/lib/images/og-host'
import { BRAND } from '@/lib/brand'

// Node runtime (not edge) so `sharp` can run — it converts the hero from WebP
// (which Satori/ImageResponse can't read) to PNG and crops it to exactly
// 1200×630, killing both the format and aspect-ratio problems in one step.
export const runtime = 'nodejs'

// Photo cards do fetch-hero → sharp resize → Satori render → sharp-to-JPEG on a
// cold MISS, which can exceed the platform default. Raise the ceiling so a cold
// render finishes and gets cached rather than being killed mid-flight (a killed
// render is what a social scraper times out on and caches blank).
export const maxDuration = 30

const OG_W = 1200
const OG_H = 630

// The card canvas colour, as sharp wants it. Must stay in sync with the '#0a0a0a'
// backgroundColor on the text card below so a letterboxed product photo blends
// into the card instead of sitting on a visible slab.
const CARD_BG_RGB = { r: 10, g: 10, b: 10 }

/** How the hero fills the 1200×630 frame. See heroDataUri. */
type OgFit = 'cover' | 'contain'

// Fetch the hero and return a 1200×630 PNG data URI, or null on any failure
// (missing/invalid url, fetch error, decode error) so the caller falls back to
// the text card rather than emitting a broken image.
async function heroDataUri(rawUrl: string | null, fit: OgFit): Promise<string | null> {
  if (!rawUrl) return null
  const url = rawUrl.split('?')[0]
  if (!isOwnImageUrl(url)) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const input = Buffer.from(await res.arrayBuffer())
    // 'cover'   — fill the frame, crop the overflow. Right for editorial hero
    //             photos, where any 1200×630 slice of the scene still reads.
    // 'contain' — fit the WHOLE image inside the frame and letterbox the gap with
    //             the card's own near-black. Right for product mockups, which are
    //             square: covering one zooms so far in that the product is cut off
    //             (a mug card showed a black wall and half a wordmark).
    const resize =
      fit === 'contain'
        ? { fit: 'contain' as const, background: CARD_BG_RGB }
        : { fit: 'cover' as const, position: 'attention' as const }
    // JPEG (not PNG): photos compress ~8× smaller, keeping the base64 data-URI
    // that Satori decodes lightweight. The final card is re-encoded by ImageResponse.
    const jpeg = await sharp(input)
      .resize(OG_W, OG_H, resize)
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

  const bg = await heroDataUri(
    searchParams.get('img'),
    searchParams.get('fit') === 'contain' ? 'contain' : 'cover',
  )

  // IMMUTABLE, one year. Safe because this URL already uniquely identifies its
  // own bytes: every render input is a query param (title/type/category/cta/img)
  // and the only hidden input — the card DESIGN — is versioned by the `v=`
  // cache-buster (OG_TEMPLATE_VERSION, see lib/og.ts). Change any input and you
  // get a different URL, so a cached entry can never go stale.
  //
  // Why this matters more than it looks: Vercel's CDN caches PER EDGE POP. At the
  // old 24h TTL, X/Facebook crawling from their own datacenters hit a POP nobody
  // had warmed and paid the full ~2s cold render (fetch hero → sharp → Satori →
  // sharp-to-JPEG). A scraper that times out there caches a NO-IMAGE card for
  // ~7 days, and X retired its Card Validator so there's no manual re-scrape.
  // `lib/og/prewarm.ts` can only ever warm the one POP it lands on, so a long
  // immutable TTL — not warming — is what actually closes the window.
  const cacheHeaders = {
    'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
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
        <span style={{ color: '#f48a4a', fontSize: '15px', fontWeight: 700 }}>{BRAND.tagline}</span>
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
    // Mirrors the photo card's structure (Satori requires every multi-child node
    // to be display:flex; the flat layout used before tripped that).
    <div style={{ width: `${OG_W}px`, height: `${OG_H}px`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#0a0a0a', padding: '56px', position: 'relative', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at top left, rgba(204, 85, 0, 0.15) 0%, transparent 60%)' }} />
      {Brand}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {Badges}
        {Title}
        {BottomBar}
      </div>
    </div>
  )

  const image = new ImageResponse(element, { width: OG_W, height: OG_H })

  // Text cards are small PNGs and keep text crisp — return as-is. Photo cards
  // come out ~0.8–1.3 MB as PNG (ImageResponse only emits PNG), which trips the
  // "image too heavy" preview warning, so recompress those to JPEG (~150–250 KB).
  // Declare Content-Length explicitly. The body is fully buffered by the time we
  // return, but without this header the platform streams it as
  // `Transfer-Encoding: chunked` with no declared size — and preview crawlers that
  // size-check a response before downloading it (X caps card images at 5MB) can
  // refuse an unknown-length body.
  if (!bg) {
    const png = await image.arrayBuffer()
    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(png.byteLength),
        ...cacheHeaders,
      },
    })
  }

  const jpeg = await sharp(Buffer.from(await image.arrayBuffer()))
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()
  return new Response(new Uint8Array(jpeg), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(jpeg.byteLength),
      ...cacheHeaders,
    },
  })
}
