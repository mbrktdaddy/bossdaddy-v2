import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndUploadImage } from '@/lib/images/dalle'
import { z } from 'zod'

export const maxDuration = 60

const GenerateSchema = z.object({
  prompt:   z.string().min(4).max(600),
  size:     z.enum(['1024x1024', '1792x1024', '1024x1792']).default('1024x1024'),
  alt_text: z.string().max(200).optional().nullable(),
})

// POST /api/images/generate — generate an image and store it in the media library
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { prompt, size, alt_text } = parsed.data

  let publicUrl: string
  try {
    publicUrl = await generateAndUploadImage(prompt, 'media', size)
  } catch (err) {
    console.error('Image generate failed:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Image generation failed: ${msg.slice(0, 160)}` }, { status: 502 })
  }

  // Extract filename from public URL
  const filename = publicUrl.split('/').pop() ?? `ai-${Date.now()}.png`

  const admin = createAdminClient()
  const { data: asset, error: dbError } = await admin
    .from('media_assets')
    .insert({
      url:         publicUrl,
      bucket:      'media',
      filename,
      alt_text:    alt_text?.trim() || prompt.slice(0, 120),
      uploaded_by: user.id,
      file_size:   null,
      mime_type:   'image/png',
    })
    .select('id, url, filename, alt_text, file_size, mime_type, created_at')
    .single()

  if (dbError) {
    console.error('media_assets insert failed after generate:', dbError)
    // Image was generated + uploaded but not indexed. Still return the URL so the user has it.
    return NextResponse.json({
      asset: { url: publicUrl, filename, alt_text: alt_text ?? null },
      warning: 'Image generated but could not be added to the library index.',
    })
  }

  return NextResponse.json({ asset }, { status: 201 })
}
