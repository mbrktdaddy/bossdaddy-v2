import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

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

let logoCache: string | null = null

// The one runtime logo (bd-logo-icon.png) as a data URI, for the logo-lockup
// template. Cached across requests.
export async function loadLogoDataUri(): Promise<string> {
  if (logoCache) return logoCache
  const buf = await readFile(join(process.cwd(), 'public', 'images', 'bd-logo-icon.png'))
  logoCache = `data:image/png;base64,${buf.toString('base64')}`
  return logoCache
}
