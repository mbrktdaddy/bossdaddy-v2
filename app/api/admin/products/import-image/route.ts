import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAdminApi } from '@/lib/auth-cache'
import { guardedFetch } from '@/lib/link-preview/fetch'

// POST /api/admin/products/import-image — fetch the image a link import found
// and hand the bytes back to the admin form, which stages it as an ordinary
// upload: compressed (EXIF stripped), normalized by /api/media, stored in our
// bucket. So a store's image is never saved as a hotlink (next/image can't
// render other hosts, and their URLs rot), and using it is the admin's choice.
//
// Same SSRF / DNS-rebinding guard and size cap as the page import. Raster
// formats only: an SVG can carry script, and the browser re-encodes anyway.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const RASTER = /^image\/(jpeg|png|webp|avif|gif)\b/

const Input = z.object({
  // Candidates in preference order; the first that downloads as a raster wins.
  urls:    z.array(z.url({ protocol: /^https?$/ }).max(2048)).min(1).max(10),
  // The product page the image was found on, sent as the Referer.
  pageUrl: z.url({ protocol: /^https?$/ }).max(2048).optional(),
})

const FAILURE: Record<string, string> = {
  'too-large':  'That image is over 10 MB.',
  'bad-type':   "That link isn't an image.",
  'bad-status': 'The site refused to hand over the image.',
  'timeout':    'The image took too long to download.',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const parsed = Input.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Not an image link.' }, { status: 400 })

  // A store often lists a hero URL that 404s while the page shows others, so
  // try each candidate in order. The last failure is the one reported.
  let failure = NextResponse.json({ error: "Couldn't download that image." }, { status: 502 })
  for (const url of parsed.data.urls) {
    const fetched = await guardedFetch(url, {
      maxBytes: MAX_IMAGE_BYTES,
      expect: 'image',
      ...(parsed.data.pageUrl ? { referer: parsed.data.pageUrl } : {}),
    })
    if (!fetched.ok) {
      console.warn('import-image failed:', fetched.reason, fetched.status ?? '', url)
      // A 404/410 is a broken link on their side, not a refusal.
      const message = fetched.status === 404 || fetched.status === 410
        ? "The site's link to that image is broken."
        : FAILURE[fetched.reason] ?? "Couldn't download that image."
      failure = NextResponse.json({ error: message }, { status: 502 })
      continue
    }
    const type = fetched.data.contentType.split(';')[0].trim()
    if (!RASTER.test(type)) {
      console.warn('import-image failed:', 'bad-type', type, url)
      failure = NextResponse.json({ error: 'Only JPEG, PNG, WebP, AVIF or GIF images can be added.' }, { status: 415 })
      continue
    }

    // A Blob body, not the Buffer: the deployed runtime can stringify a Buffer
    // body (the same failure lib/storage-body.ts guards for storage uploads).
    return new NextResponse(new Blob([new Uint8Array(fetched.data.body)], { type }), {
      headers: { 'Content-Type': type, 'Cache-Control': 'no-store' },
    })
  }
  return failure
}
