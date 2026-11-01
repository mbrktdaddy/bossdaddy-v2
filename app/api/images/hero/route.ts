import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  discardDrafts,
  finalizeFromDraft,
  generateContactSheet,
  generateImage,
  ImageContentPolicyError,
  SHEET_FILENAME_RE,
  type GeneratedImage,
} from '@/lib/images/openai'
import { buildSafetyRules, EDITORIAL, resolveToggles } from '@/lib/images/safety'
import { logGeneration } from '@/lib/content/generations'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

// OpenAI says complex prompts on the gpt-image-2.5 models can take up to 2 minutes.
// Single = one render plus the vision QA pass and one retry on a hard fail; sheet =
// three parallel low-quality renders (no QA, so it finishes well inside this);
// finalize = one image edit at high quality plus QA and one retry. 180s is headroom
// for a slow render plus QA — it is not a budget for two worst-case renders back to back.
export const maxDuration = 180

const HeroInput = z.object({
  title:         z.string().min(1).max(150),
  category:      z.string().min(1).max(80),
  excerpt:       z.string().max(200).optional().nullable(),
  content_type:  z.enum(['guide', 'review']),
  product_name:  z.string().max(120).optional().nullable(),
  // Same ceiling as /api/images/generate: the photo editor writes up to 700
  // characters (lib/images/doctrine.ts) and the author may extend one in the panel.
  custom_prompt: z.string().max(1000).optional().nullable(),
  premium:       z.boolean().optional().default(false),
  // Lane knobs (lib/images/safety.ts EDITORIAL is the baseline: no text,
  // people anonymous, brands pinned off). The panel sends them explicitly.
  people:        z.enum(['none', 'anonymous', 'allowed']).optional(),
  no_text:       z.boolean().optional(),
  // The editorial look (lib/images/style.ts): photo by default; an essay or
  // flagged guide asks for an illustration. Same rules either way.
  look:          z.enum(['photo', 'illustration']).optional(),
  // The guide/review draft id this hero belongs to. Used to index the generated
  // image into media_assets with source linkage so it's reusable from the
  // library/picker (e.g. attaching it to an X post), and to put the cost on the
  // piece's chip. Optional — generation still works without it.
  source_id:     z.string().uuid().optional().nullable(),
  // single   — one render (today's behaviour).
  // sheet    — a contact sheet: three cheap drafts to pick a composition from.
  // finalize — the Publication render of a picked draft (draft_filename).
  // discard  — remove sheet drafts the author walked away from.
  mode:          z.enum(['single', 'sheet', 'finalize', 'discard']).optional().default('single'),
  moderation:    z.enum(['low', 'auto']).optional(),
  draft_filename:    z.string().regex(SHEET_FILENAME_RE).optional().nullable(),
  discard_filenames: z.array(z.string().regex(SHEET_FILENAME_RE)).max(3).optional(),
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
  const parsed = HeroInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const {
    title, category, excerpt, content_type, custom_prompt, premium, people, no_text, look, source_id,
    mode, moderation, draft_filename, discard_filenames,
  } = parsed.data

  const bucket = content_type === 'review' ? 'review-images' : 'guide-images'

  // Cleanup is free and must work even when the hourly limit is spent.
  if (mode === 'discard') {
    await discardDrafts(bucket, discard_filenames ?? [])
    return NextResponse.json({ ok: true })
  }

  // Once per request — a contact sheet counts as one.
  const { success } = await checkRateLimit(`image-gen:${user.id}`, 'image-gen')
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded — you can generate 60 images per hour (a contact sheet counts as one).' }, { status: 429 })

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

  const subject = `${title}${excerpt ? ` — ${excerpt}` : ''}`

  const fail = (err: unknown) => {
    if (err instanceof ImageContentPolicyError) {
      return NextResponse.json({ error: err.message, code: 'content_policy', promptUsed: basePrompt }, { status: 422 })
    }
    console.error('Hero image generation error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Image generation failed: ${msg.slice(0, 120)}` }, { status: 502 })
  }

  if (mode === 'sheet') {
    let sheet
    try {
      sheet = await generateContactSheet({
        prompt: basePrompt,
        bucket,
        size: '1536x1024',
        toggles,
        lane: 'editorial',
        aspect: '16:10',
        subject,
        moderation,
        look,
      })
    } catch (err) {
      return fail(err)
    }

    // One row per draft so each draft's cost lands on the piece's chip. Drafts
    // are scratch: they are NOT indexed into media_assets.
    let totalCost: number | null = 0
    for (const [i, d] of sheet.drafts.entries()) {
      totalCost = totalCost == null || d.costUsd == null ? null : totalCost + d.costUsd
      await logGeneration(supabase, {
        userId: user.id,
        contentType: content_type,
        contentId: source_id ?? null,
        stage: 'image',
        status: 'done',
        meta: { model: sheet.model, usage: undefined, finishReason: 'stop', latencyMs: sheet.latencyMs, costUsd: d.costUsd },
        input: { prompt: basePrompt, lane: 'editorial', size: '1536x1024', aspect: '16:10', kind: 'sheet', index: i, quality: sheet.quality, moderation, toggles, rules: buildSafetyRules(toggles, look ?? 'photo'), look: look ?? 'photo' },
        output: { url: d.url, filename: d.filename },
      })
    }

    return NextResponse.json({
      sheet: {
        drafts: sheet.drafts.map(d => ({ url: d.url, filename: d.filename, width: d.width, height: d.height })),
        model: sheet.model,
        quality: sheet.quality,
        costUsd: totalCost,
        latencyMs: sheet.latencyMs,
      },
      promptUsed: basePrompt,
    })
  }

  let result: GeneratedImage
  try {
    if (mode === 'finalize') {
      if (!draft_filename) {
        return NextResponse.json({ error: 'draft_filename is required to finalize a contact-sheet draft.' }, { status: 400 })
      }
      result = await finalizeFromDraft({
        prompt: basePrompt,
        bucket,
        size: '1536x1024',
        toggles,
        lane: 'editorial',
        aspect: '16:10',
        subject,
        draftFilename: draft_filename,
        discardFilenames: discard_filenames,
        look,
      })
    } else {
      result = await generateImage({
        prompt: basePrompt,
        bucket,
        size: '1536x1024',
        premium,
        toggles,
        lane: 'editorial',
        aspect: '16:10',
        subject,
        moderation,
        look,
      })
    }
  } catch (err) {
    return fail(err)
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
    input: {
      prompt: basePrompt, lane: 'editorial', size: '1536x1024', aspect: '16:10', premium, quality: result.quality, moderation,
      toggles, attempts: result.attempts, rules: buildSafetyRules(toggles, look ?? 'photo'), look: look ?? 'photo',
      ...(mode === 'finalize' ? { kind: 'finalize', draft: draft_filename } : {}),
    },
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
