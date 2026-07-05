import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

// Brand fonts for the Merch Studio renderer (Satori/next-og). Satori needs raw
// TTF/OTF buffers — it can't use the next/font woff2 cache. Montserrat is the
// brand display face (see app/layout.tsx); we ship Black (900) for statement
// text and SemiBold (600) for sublines/wordmark secondary. Files are bundled
// into the render function via outputFileTracingIncludes in next.config.ts.

export interface LoadedFont {
  name: string
  data: Buffer
  weight: 400 | 600 | 700 | 900
  style: 'normal'
}

let fontCache: LoadedFont[] | null = null

export async function loadMerchFonts(): Promise<LoadedFont[]> {
  if (fontCache) return fontCache
  const dir = join(process.cwd(), 'lib', 'merch', 'fonts')
  const [black, semibold] = await Promise.all([
    readFile(join(dir, 'Montserrat-Black.ttf')),
    readFile(join(dir, 'Montserrat-SemiBold.ttf')),
  ])
  fontCache = [
    { name: 'Montserrat', data: black, weight: 900, style: 'normal' },
    { name: 'Montserrat', data: semibold, weight: 600, style: 'normal' },
  ]
  return fontCache
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return { r: 0, g: 0, b: 0 }
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

// Keyed by color (or 'original') so each recolor is computed once per process.
const logoCache = new Map<string, string>()

// The runtime logo (bd-logo-icon.png) as a data URI. The mark is a flat
// single-color badge with knockout letters, so we can recolor it to guarantee
// contrast on the chosen garment: pass the colorway ink (cream on dark, near-
// black on light). The knockouts stay transparent (garment shows through), and
// a one-color mark is exactly what DTG/embroidery wants. Omit `color` for the
// original orange art.
export async function loadLogoDataUri(color?: string): Promise<string> {
  const key = color ?? 'original'
  const cached = logoCache.get(key)
  if (cached) return cached

  const src = join(process.cwd(), 'public', 'images', 'bd-logo-icon.png')
  let outBuf: Buffer
  if (!color) {
    outBuf = await readFile(src)
  } else {
    const withAlpha = sharp(await readFile(src)).ensureAlpha()
    const meta = await withAlpha.metadata()
    const w = meta.width ?? 1024
    const h = meta.height ?? 1024
    // Use the logo's alpha as a silhouette mask over a solid ink fill.
    const alpha = await sharp(await readFile(src)).ensureAlpha().extractChannel(3).toColourspace('b-w').toBuffer()
    const { r, g, b } = hexToRgb(color)
    outBuf = await sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } })
      .joinChannel(alpha)
      .png()
      .toBuffer()
  }

  const uri = `data:image/png;base64,${outBuf.toString('base64')}`
  logoCache.set(key, uri)
  return uri
}

const merchLogoCache = new Map<string, string>()

// The merch-print logo for a garment colorway — uses the purpose-designed art in
// lib/merch/assets (on-dark = Hot orange #E55A1A, on-light = core orange #CC5500).
// Falls back to recoloring the runtime icon to the matching brand orange if a
// file is ever missing. Merch-only — never wired into the app UI (which keeps
// using bd-logo-icon.png per the brand-asset rule).
export async function loadMerchLogo(colorway: 'dark' | 'light'): Promise<string> {
  const cached = merchLogoCache.get(colorway)
  if (cached) return cached

  const file = colorway === 'dark' ? 'bd-logo-on-dark.png' : 'bd-logo-on-light.png'
  let uri: string
  try {
    const buf = await readFile(join(process.cwd(), 'lib', 'merch', 'assets', file))
    uri = `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    uri = await loadLogoDataUri(colorway === 'dark' ? '#E55A1A' : '#CC5500')
  }
  merchLogoCache.set(colorway, uri)
  return uri
}
