import { ImageResponse } from 'next/og'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { loadMerchFonts, loadLogoDataUri } from '@/lib/merch/fonts'
import {
  renderTemplate,
  COLORWAYS,
  MERCH_TEMPLATES,
  MERCH_COLORWAYS,
  type MerchTemplate,
  type MerchColorway,
} from '@/lib/merch/templates'
import { MERCH_CATALOG, type MerchBlank } from '@/lib/merch/printful-catalog'

// Node runtime so we can read the TTF/logo files from disk (Satori needs raw
// font buffers; edge can't do fs).
export const runtime = 'nodejs'

const PREVIEW_MAX_W = 600

// Default mock garment color for on-screen preview (the print file itself is
// always transparent). Dark colorway previews on a charcoal tee, light on cream.
const PREVIEW_GARMENT: Record<MerchColorway, string> = {
  dark: '#1c1c1e',
  light: '#e9e4da',
}

async function requireAdmin() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const sp = request.nextUrl.searchParams
  const template = (MERCH_TEMPLATES.includes(sp.get('template') as MerchTemplate)
    ? sp.get('template')
    : 'statement') as MerchTemplate
  const colorway = (MERCH_COLORWAYS.includes(sp.get('colorway') as MerchColorway)
    ? sp.get('colorway')
    : 'dark') as MerchColorway
  const blank = (['tee', 'hat', 'mug'].includes(sp.get('blank') as MerchBlank)
    ? sp.get('blank')
    : 'tee') as MerchBlank
  const mode = sp.get('mode') === 'print' ? 'print' : 'preview'
  const text = (sp.get('text') ?? '').slice(0, 200)
  const subline = (sp.get('subline') ?? '').slice(0, 200)

  // Print dimensions come from the pinned Printful placement; preview is a scaled
  // copy that keeps the exact aspect ratio.
  const placement = MERCH_CATALOG[blank].placements[0]
  let W = placement.widthPx
  let H = placement.heightPx
  if (mode === 'preview' && W > PREVIEW_MAX_W) {
    const scale = PREVIEW_MAX_W / W
    W = Math.round(W * scale)
    H = Math.round(H * scale)
  }

  const bg =
    mode === 'print'
      ? 'transparent'
      : (sp.get('garment') && /^#[0-9a-fA-F]{6}$/.test(sp.get('garment')!)
          ? sp.get('garment')!
          : PREVIEW_GARMENT[colorway])

  const [fonts, logo] = await Promise.all([
    loadMerchFonts(),
    template === 'logo' ? loadLogoDataUri() : Promise.resolve(undefined),
  ])

  const element = renderTemplate(template, {
    text: text || (template === 'logo' ? '' : 'Boss Daddy'),
    subline,
    colorway: COLORWAYS[colorway],
    bg,
    W,
    H,
    logo,
  })

  const image = new ImageResponse(element, {
    width: W,
    height: H,
    fonts: fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: f.style })),
  })

  // Admin-only, ephemeral — don't let CDNs cache design iterations.
  return new Response(await image.arrayBuffer(), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
      ...(mode === 'print'
        ? { 'Content-Disposition': `attachment; filename="${blank}-${template}-${colorway}.png"` }
        : {}),
    },
  })
}
