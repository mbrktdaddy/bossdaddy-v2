import { NextResponse, type NextRequest } from 'next/server'
import sharp from 'sharp'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { isOwnImageUrl } from '@/lib/images/og-host'
import { toStorageBody, verifyStoredMagic } from '@/lib/storage-body'
import { CARD_SIZES, CARD_TEXT_MAX, renderCardPng } from '@/lib/images/card'

// POST /api/images/card — compose a text card (a statement, optionally over the
// author's own photo) and store it in the media library.
//
// Cards are rendered in CODE (Satori + the real Montserrat files), never by the
// image model: text inside an AI image is the uncanny tell (brand guide §2), and
// a card's whole job is that the words come out exactly as typed. Because we
// composed it ourselves the asset is origin 'own', not 'ai'.
export const runtime = 'nodejs'
export const maxDuration = 30

const CardSchema = z.object({
  text:        z.string().trim().min(2).max(CARD_TEXT_MAX),
  kicker:      z.string().trim().max(40).optional(),
  attribution: z.string().trim().max(40).optional(),
  variant:     z.enum(['block', 'photo']).default('block'),
  size:        z.enum(['square', 'landscape', 'portrait']).default('square'),
  image_url:   z.string().url().max(2000).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = CardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
  const { text, kicker, attribution, variant, size, image_url } = parsed.data

  // Code-rendered, no model call — a flood backstop, not a budget guard.
  const { success } = await checkRateLimit(`image-card:${user.id}`, 'image-card')
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded — you can render 60 cards per hour.' }, { status: 429 })

  const { width, height } = CARD_SIZES[size]

  // Photo look: the author's own library photo, cropped to the card and handed
  // to Satori as a JPEG data URI (the OG route's pattern; Satori can't read WebP).
  let imageDataUri: string | null = null
  if (variant === 'photo') {
    if (!image_url) return NextResponse.json({ error: 'A photo card needs a library photo' }, { status: 400 })
    const url = image_url.split('?')[0]
    if (!isOwnImageUrl(url)) return NextResponse.json({ error: 'Could not load that photo' }, { status: 400 })
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`photo fetch ${res.status}`)
      const input = Buffer.from(await res.arrayBuffer())
      const jpeg = await sharp(input)
        .resize(width, height, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer()
      imageDataUri = `data:image/jpeg;base64,${jpeg.toString('base64')}`
    } catch (err) {
      console.error('Card photo load failed:', err)
      return NextResponse.json({ error: 'Could not load that photo' }, { status: 400 })
    }
  }

  let bytes: Buffer
  try {
    const png = await renderCardPng({ text, kicker, attribution, variant, size, imageDataUri })
    bytes = await sharp(png.buffer).webp({ quality: 90 }).toBuffer()
  } catch (err) {
    console.error('Card render failed:', err)
    return NextResponse.json({ error: 'Card render failed. Please try again.' }, { status: 500 })
  }

  const admin = createAdminClient()
  const filename = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`
  const { error: uploadError } = await admin.storage
    .from('media')
    .upload(filename, toStorageBody(bytes, 'image/webp'), { contentType: 'image/webp', upsert: false })
  if (uploadError) {
    console.error('Card upload failed:', uploadError)
    return NextResponse.json({ error: 'Card upload failed. Please try again.' }, { status: 500 })
  }

  const corruption = await verifyStoredMagic(admin.storage.from('media'), filename, 'image/webp')
  if (corruption) {
    await admin.storage.from('media').remove([filename]).catch(() => { /* best effort */ })
    console.error(`Card upload verification FAILED for media/${filename}: ${corruption}`)
    return NextResponse.json({ error: 'Card was corrupted in transit and was discarded. Please try again.' }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('media').getPublicUrl(filename)
  const altText = text.slice(0, 200)

  const { data: asset, error: dbError } = await admin
    .from('media_assets')
    .insert({
      url:         publicUrl,
      bucket:      'media',
      filename,
      alt_text:    altText,
      uploaded_by: user.id,
      file_size:   bytes.length,
      mime_type:   'image/webp',
      origin:      'own',
      width,
      height,
    })
    .select('id, url, filename, alt_text, file_size, mime_type, created_at, width, height, origin')
    .single()

  if (dbError) {
    console.error('media_assets insert failed after card render:', dbError)
    // Rendered + uploaded but not indexed. Still return it so the author has it.
    return NextResponse.json({
      asset: { url: publicUrl, filename, alt_text: altText, width, height, origin: 'own' },
      warning: 'Card rendered but could not be added to the library index.',
    })
  }

  return NextResponse.json({ asset }, { status: 201 })
}
