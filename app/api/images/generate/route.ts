import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateImage, ImageContentPolicyError } from '@/lib/images/openai'
import { buildSafetyRules, EDITORIAL, peopleFromLegacy, resolveToggles, SOCIAL_FLEXIBLE } from '@/lib/images/safety'
import { logGeneration } from '@/lib/content/generations'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

// Generation + one QA + one retry + one QA can run past 60s on the premium tier.
export const maxDuration = 120

const GenerateSchema = z.object({
  prompt:   z.string().min(4).max(600),
  size:     z.enum(['1024x1024', '1536x1024', '1024x1536']).default('1024x1024'),
  alt_text: z.string().max(200).optional().nullable(),
  premium:  z.boolean().optional().default(false),
  // Where the image is used (lib/images/safety.ts presets + the house style):
  //   editorial — body figures on reviews/guides/collections: house style,
  //               no text, people anonymous by default, vision QA + alt from pixels.
  //   social    — media library, X Studio, quote cards: text + people allowed, no style.
  lane:      z.enum(['editorial', 'social']).optional().default('social'),
  no_text:   z.boolean().optional(),
  /** Legacy boolean from the social-lane clients; `people` wins when both are sent. */
  no_people: z.boolean().optional(),
  people:    z.enum(['none', 'anonymous', 'allowed']).optional(),
  /** What QA should expect to see (the slot's alt/caption); defaults to the prompt. */
  subject:   z.string().max(400).optional().nullable(),
  // The piece this figure belongs to — links the asset in the library and
  // puts the cost on the piece's chip (generations, mig 164). Optional.
  source_type: z.enum(['review', 'guide']).optional().nullable(),
  source_id:   z.string().uuid().optional().nullable(),
})

// POST /api/images/generate — generate an image and store it in the media library
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { success } = await checkRateLimit(`image-gen:${user.id}`, 'image-gen')
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded — you can generate 20 images per hour.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { prompt, size, alt_text, premium, lane, no_text, no_people, people, subject, source_type, source_id } = parsed.data

  const base = lane === 'editorial' ? EDITORIAL : SOCIAL_FLEXIBLE
  const toggles = resolveToggles(base, {
    noText: no_text,
    people: people ?? peopleFromLegacy(no_people, base.people),
  })

  const startedAt = Date.now()
  let result
  try {
    result = await generateImage({
      prompt,
      bucket: 'media',
      size,
      premium,
      toggles,
      lane,
      subject: subject?.trim() || alt_text?.trim() || prompt,
    })
  } catch (err) {
    if (err instanceof ImageContentPolicyError) {
      // Surfaced, never substituted: the panel offers "edit the prompt".
      return NextResponse.json({ error: err.message, code: 'content_policy' }, { status: 422 })
    }
    console.error('Image generate failed:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Image generation failed: ${msg.slice(0, 160)}` }, { status: 502 })
  }

  // Alt text from the pixels (QA) beats the pre-generation guess; the author's
  // explicit alt is the fallback, the prompt the last resort.
  const altText = result.qa?.report.altText?.trim() || alt_text?.trim() || prompt.slice(0, 120)

  const admin = createAdminClient()
  const { data: asset, error: dbError } = await admin
    .from('media_assets')
    .insert({
      url:         result.url,
      bucket:      'media',
      filename:    result.filename,
      alt_text:    altText,
      uploaded_by: user.id,
      file_size:   null,
      mime_type:   'image/webp',
      origin:      'ai',
      width:       result.width,
      height:      result.height,
      source_type: source_type && source_id ? source_type : null,
      source_id:   source_type && source_id ? source_id : null,
    })
    .select('id, url, filename, alt_text, file_size, mime_type, created_at, width, height, origin')
    .single()

  // The cost lands on the piece's chip when the panel told us which piece.
  if (source_type) {
    await logGeneration(supabase, {
      userId: user.id,
      contentType: source_type,
      contentId: source_id ?? null,
      stage: 'image',
      status: 'done',
      meta: { model: result.model, usage: undefined, finishReason: 'stop', latencyMs: result.latencyMs, costUsd: result.costUsd },
      input: { prompt, lane, size, premium, quality: result.quality, toggles, attempts: result.attempts, rules: buildSafetyRules(toggles) },
      output: { url: result.url, qa: result.qa },
    })
  }

  const extras = { qa: result.qa, attempts: result.attempts, model: result.model, latencyMs: Date.now() - startedAt }

  if (dbError) {
    console.error('media_assets insert failed after generate:', dbError)
    // Image was generated + uploaded but not indexed. Still return it so the author has it.
    return NextResponse.json({
      asset: { url: result.url, filename: result.filename, alt_text: altText, width: result.width, height: result.height, origin: 'ai' },
      warning: 'Image generated but could not be added to the library index.',
      ...extras,
    })
  }

  return NextResponse.json({ asset, ...extras }, { status: 201 })
}
