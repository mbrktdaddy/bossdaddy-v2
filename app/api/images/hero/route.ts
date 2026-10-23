import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateImage, ImageContentPolicyError } from '@/lib/images/openai'
import { buildSafetyRules, EDITORIAL, resolveToggles } from '@/lib/images/safety'
import { logGeneration } from '@/lib/content/generations'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

// Generation + QA + one retry + QA can run past 60s on the premium tier.
export const maxDuration = 120

const HeroInput = z.object({
  title:         z.string().min(1).max(150),
  category:      z.string().min(1).max(80),
  excerpt:       z.string().max(200).optional().nullable(),
  content_type:  z.enum(['guide', 'review']),
  product_name:  z.string().max(120).optional().nullable(),
  custom_prompt: z.string().max(600).optional().nullable(),
  premium:       z.boolean().optional().default(false),
  // Lane knobs (lib/images/safety.ts EDITORIAL is the baseline: no text,
  // people anonymous, brands pinned off). The panel sends them explicitly.
  people:        z.enum(['none', 'anonymous', 'allowed']).optional(),
  no_text:       z.boolean().optional(),
  // The guide/review draft id this hero belongs to. Used to index the generated
  // image into media_assets with source linkage so it's reusable from the
  // library/picker (e.g. attaching it to an X post), and to put the cost on the
  // piece's chip. Optional — generation still works without it.
  source_id:     z.string().uuid().optional().nullable(),
})

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
  const parsed = HeroInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { title, category, excerpt, content_type, custom_prompt, premium, people, no_text, source_id } = parsed.data

  // AI heroes are editorial context only — never the product (owned photography
  // via 📷 Take Photo is the right asset for the actual product). The subject
  // prompt below is what the author sees and edits; lighting/lens/palette come
  // from the house style (lib/images/style.ts), the rules from the lane preset.
  const toggles = resolveToggles(EDITORIAL, { people, noText: no_text })

  const basePrompt = custom_prompt?.trim()
    ? custom_prompt.trim()
    : content_type === 'review'
    ? `A candid real-world scene from the ${category} category${excerpt ? ` — ${excerpt}` : ''}: ` +
      'the setting and the everyday objects around where something like this gets used, the product itself out of frame.'
    : `A candid real-world scene representing "${title}"${excerpt ? ` — ${excerpt}` : ''} (${category}): ` +
      'the setting, the objects and the moment a reader would recognise from their own week.'

  const bucket = content_type === 'review' ? 'review-images' : 'guide-images'

  let result
  try {
    result = await generateImage({
      prompt: basePrompt,
      bucket,
      size: '1536x1024',
      premium,
      toggles,
      lane: 'editorial',
      aspect: '16:10',
      subject: `${title}${excerpt ? ` — ${excerpt}` : ''}`,
    })
  } catch (err) {
    if (err instanceof ImageContentPolicyError) {
      return NextResponse.json({ error: err.message, code: 'content_policy', promptUsed: basePrompt }, { status: 422 })
    }
    console.error('Hero image generation error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Image generation failed: ${msg.slice(0, 120)}` }, { status: 502 })
  }

  const altText = result.qa?.report.altText?.trim() || title.slice(0, 200)

  // Index the generated hero into the media library so it's reusable from the
  // picker (with source linkage). Best-effort: a failure here must not fail the
  // generation — the image is already stored and returned.
  try {
    const admin = createAdminClient()
    await admin.from('media_assets').insert({
      url:         result.url,
      bucket,
      filename:    result.filename,
      alt_text:    altText,
      uploaded_by: user.id,
      file_size:   null,
      mime_type:   'image/webp',
      source_type: content_type,
      source_id:   source_id ?? null,
      origin:      'ai',
      width:       result.width,
      height:      result.height,
    })
  } catch (indexErr) {
    console.error('Hero media_assets index failed (non-fatal):', indexErr)
  }

  await logGeneration(supabase, {
    userId: user.id,
    contentType: content_type,
    contentId: source_id ?? null,
    stage: 'image',
    status: 'done',
    meta: { model: result.model, usage: undefined, finishReason: 'stop', latencyMs: result.latencyMs, costUsd: result.costUsd },
    input: { prompt: basePrompt, lane: 'editorial', size: '1536x1024', aspect: '16:10', premium, quality: result.quality, toggles, attempts: result.attempts, rules: buildSafetyRules(toggles) },
    output: { url: result.url, qa: result.qa },
  })

  return NextResponse.json({
    imageUrl: result.url,
    promptUsed: basePrompt,
    altText,
    width: result.width,
    height: result.height,
    qa: result.qa,
    attempts: result.attempts,
    model: result.model,
  })
}
