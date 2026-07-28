import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 30

// Only our own storage buckets are downloadable — this is NOT an open proxy.
const ALLOWED_BUCKETS = ['media', 'guide-images', 'review-images']

// GET /api/media/download?url=<public storage url>&name=<optional filename>
//
// Forces a real file download (Content-Disposition: attachment) with a readable
// filename. Needed because the storage CDN is a different origin, so a plain
// <a download> is ignored by browsers and the raw filenames are ai-<ts>.webp.
// We fetch by bucket+key via the admin storage client (never an arbitrary URL),
// so there's no SSRF surface. Gated to admin/author like the rest of /api/media.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const target = (searchParams.get('url') ?? '').split('?')[0] // drop any cache-buster
  const downloadName = searchParams.get('name')?.trim() || null

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })

  // Must be one of our own public storage URLs.
  const prefix = `${base}/storage/v1/object/public/`
  if (!target.startsWith(prefix)) {
    return NextResponse.json({ error: 'Only Boss Daddy storage URLs can be downloaded' }, { status: 400 })
  }

  const rest = target.slice(prefix.length) // "<bucket>/<key...>"
  const slash = rest.indexOf('/')
  if (slash < 1) return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })

  const bucket = rest.slice(0, slash)
  const key = decodeURIComponent(rest.slice(slash + 1))
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: 'Unknown bucket' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: blob, error } = await admin.storage.from(bucket).download(key)
  if (error || !blob) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  // MUST be a Uint8Array, never a Node Buffer. `Buffer` is not part of the Web
  // `BodyInit` union, so when the runtime doesn't recognize it as a TypedArray it
  // falls back to `String(body)` — a UTF-8 decode that replaces every byte >=
  // 0x80 with U+FFFD. That shipped a 180KB .webp whose header read
  // `52 49 46 46 2c ef bf bd` (RIFF + replacement chars) with 41,102 U+FFFD runs
  // and the WEBP marker shoved from offset 8 to 10 — silently corrupt, and only
  // on the deployed runtime, so it looked fine in local dev.
  // `app/api/img/route.ts` already wraps in Uint8Array for this reason.
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const ext = key.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp'
  const stem =
    (downloadName ? downloadName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-') : '') ||
    key.split('/').pop()?.replace(/\.[^.]+$/, '') ||
    'boss-daddy-image'
  const filename = `${stem}.${ext}`

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': blob.type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, no-store',
    },
  })
}
