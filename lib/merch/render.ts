import { ImageResponse } from 'next/og'
import { loadMerchFonts, loadMerchLogo } from './fonts'
import { renderTemplate, COLORWAYS, type MerchTemplate, type MerchColorway } from './templates'
import { MERCH_CATALOG, type MerchBlank } from './printful-catalog'

// Shared render core for the Merch Studio design engine. Used by both the
// preview route (app/api/merch/render) and the publish flow (which persists the
// print file to storage). Node runtime only (Satori + font fs reads).

const PREVIEW_MAX_W = 600

// Mock garment color for on-screen preview (print files are always transparent).
const PREVIEW_GARMENT: Record<MerchColorway, string> = {
  dark: '#1c1c1e',
  light: '#e9e4da',
}

export interface RenderOpts {
  template: MerchTemplate
  colorway: MerchColorway
  blank: MerchBlank
  mode: 'preview' | 'print'
  text: string
  subline?: string
  garment?: string // preview only — mock garment hex
}

export async function renderMerchPng(
  opts: RenderOpts,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const spec = MERCH_CATALOG[opts.blank]
  let W = spec.printWidthPx
  let H = spec.printHeightPx
  if (opts.mode === 'preview' && W > PREVIEW_MAX_W) {
    const scale = PREVIEW_MAX_W / W
    W = Math.round(W * scale)
    H = Math.round(H * scale)
  }

  const bg =
    opts.mode === 'print'
      ? 'transparent'
      : opts.garment && /^#[0-9a-fA-F]{6}$/.test(opts.garment)
        ? opts.garment
        : PREVIEW_GARMENT[opts.colorway]

  const [fonts, logo] = await Promise.all([
    loadMerchFonts(),
    opts.template === 'logo' ? loadMerchLogo(opts.colorway) : Promise.resolve(undefined),
  ])

  const element = renderTemplate(opts.template, {
    text: opts.text || (opts.template === 'logo' ? '' : 'Boss Daddy'),
    subline: opts.subline ?? '',
    colorway: COLORWAYS[opts.colorway],
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
  const buffer = Buffer.from(await image.arrayBuffer())
  return { buffer, width: W, height: H }
}
