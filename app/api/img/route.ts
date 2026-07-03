import { type NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { isOwnImageUrl } from '@/lib/images/og-host'

// Aspect-ratio crops of our own hero images, for JSON-LD structured-data image
// arrays (Google recommends 16:9, 4:3, and 1:1 variants for rich results).
// Node runtime so sharp can read WebP + cover-crop; host-guarded (no open proxy).
export const runtime = 'nodejs'

// width 1200 baseline → each ratio well above Google's 50k-pixel minimum.
const RATIOS: Record<string, { w: number; h: number }> = {
  '16x9': { w: 1200, h: 675 },
  '4x3':  { w: 1200, h: 900 },
  '1x1':  { w: 1200, h: 1200 },
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ar = searchParams.get('ar') ?? '16x9'
  const rawUrl = (searchParams.get('url') ?? '').split('?')[0]

  const dims = RATIOS[ar]
  if (!dims) return NextResponse.json({ error: 'Unsupported aspect ratio' }, { status: 400 })
  if (!isOwnImageUrl(rawUrl)) return NextResponse.json({ error: 'Only Boss Daddy images can be transformed' }, { status: 400 })

  try {
    const res = await fetch(rawUrl)
    if (!res.ok) return NextResponse.json({ error: 'Source image not found' }, { status: 404 })
    const input = Buffer.from(await res.arrayBuffer())
    const jpeg = await sharp(input)
      .resize(dims.w, dims.h, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Image transform failed' }, { status: 502 })
  }
}
