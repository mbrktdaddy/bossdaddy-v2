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
import { buildSafetyRules, EDITORIAL, peopleFromLegacy, resolveToggles, SOCIAL_FLEXIBLE } from '@/lib/images/safety'
import { logGeneration } from '@/lib/content/generations'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

// The 2.5 image models can take up to 2 minutes at high quality. Single = one render
// plus vision QA and one retry; sheet = three parallel low-quality renders (no QA);
// finalize = one image edit at high quality plus QA and one retry.
export const maxDuration = 180

const GenerateSchema = z.object({
  // The photo-editor stage writes 400-700 characters (lib/images/doctrine.ts) and
  // the author may extend one in the panel, so the ceiling sits above both.
  prompt:   z.string().min(4).max(1000),
  size:     z.enum(['1024x1024', '1536x1024', '1024x1536']).default('1024x1024'),
  // '4:5' is generated on the 1024x1536 portrait and centre-cropped to the phone-first
  // figure shape; every other shape is the size itself, so only 4:5 is sent.
  aspect:   z.enum(['4:5']).optional().nullable(),
  alt_text: z.string().max(200).optional().nullable(),
  premium:  z.boolean().optional().default(false),
  // Where the image is used (lib/images/safety.ts presets + the house style):
  //   editorial — body figures on reviews/guides/collections: house style,
  //               no text, people anonymous by default, vision QA + alt from pixels.
  //   social    — media library, X Studio, quote cards: text + people allowed, no style.
  lane:      z.enum(['editorial', 'social']).optional().default('social'),
  no_text:   z.boolean().optional(),
  /** Editorial look (lib/images/style.ts): photo by default, or an illustration. Editorial lane only; ignored on social. */
  look:      z.enum(['photo', 'illustration']).optional(),
  /** Legacy boolean from the social-lane clients; `people` wins when both are sent. */
  no_people: z.boolean().optional(),
  people:    z.enum(['none', 'anonymous', 'allowed']).optional(),
  /** What QA should expect to see (the slot's alt/caption); defaults to the prompt. */
  subject:   z.string().max(400).optional().nullable(),
  // The piece this figure belongs to — links the asset in the library and
  // puts the cost on the piece's chip (generations, mig 164). Optional.
  source_type: z.enum(['review', 'guide']).optional().nullable(),
  source_id:   z.string().uuid().optional().nullable(),
  // single   — one render (today's behaviour).
  // sheet    — a contact sheet: three cheap drafts to pick a composition from.
  // finalize — the Publication render of a picked draft (draft_filename).
  // discard  — remove sheet drafts the author walked away from.
  mode:        z.enum(['single', 'sheet', 'finalize', 'discard']).optional().default('single'),
  moderation:  z.enum(['low', 'auto']).optional(),
  draft_filename:    z.string().regex(SHEET_FILENAME_RE).optional().nullable(),
  discard_filenames: z.array(z.string().regex(SHEET_FILENAME_RE)).max(3).optional(),
})

const DiscardSchema = z.object({
  mode: z.literal('discard'),
  discard_filenames: z.array(z.string().regex(SHEET_FILENAME_RE)).max(3),
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

  const body = await request.json().catch(() => null)

  // Cleanup is free and must work even when the hourly limit is spent. The
  // panel fires it without a prompt (the drafts are scratch files), so it
  // parses its own two fields instead of the full generate schema.
  if (body && typeof body === 'object' && (body as { mode?: unknown }).mode === 'discard') {
    const discard = DiscardSchema.safeParse(body)
    if (!discard.success) {
      return NextResponse.json({ error: 'Invalid input', details: discard.error.flatten() }, { status: 400 })
    }
    await discardDrafts('media', discard.data.discard_filenames)
    return NextResponse.json({ ok: true })
  }

  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const {
    prompt, size, aspect, alt_text, premium, lane, no_text, no_people, people, look: lookInput, subject, source_type, source_id,
    mode, moderation, draft_filename, discard_filenames,
  } = parsed.data

  // Once per request — a contact sheet counts as one.
  const { success } = await checkRateLimit(`image-gen:${user.id}`, 'image-gen')
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded — you can generate 60 images per hour (a contact sheet counts as one).' }, { status: 429 })

  const base = lane === 'editorial' ? EDITORIAL : SOCIAL_FLEXIBLE
  const toggles = resolveToggles(base, {
    noText: no_text,
    people: people ?? peopleFromLegacy(no_people, base.people),
  })

  // The look only exists on the editorial lane; a social image is never styled.
  const look = lane === 'editorial' ? (lookInput ?? 'photo') : undefined

  const qaSubject = subject?.trim() || alt_text?.trim() || prompt

  const fail = (err: unknown) => {
    if (err instanceof ImageContentPolicyError) {
      // Surfaced, never substituted: the panel offers "edit the prompt".
      return NextResponse.json({ error: err.message, code: 'content_policy' }, { status: 422 })
    }
    console.error('Image generate failed:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Image generation failed: ${msg.slice(0, 160)}` }, { status: 502 })
  }

  if (mode === 'sheet') {
    let sheet
    try {
      sheet = await generateContactSheet({
        prompt,
        bucket: 'media',
        size,
        aspect: aspect ?? null,
        toggles,
        lane,
        subject: qaSubject,
        moderation,
        look,
      })
    } catch (err) {
      return fail(err)
    }

    // One row per draft (only when the panel named the piece, as for single).
    // Drafts are scratch: they are NOT indexed into media_assets.
    let totalCost: number | null = 0
    for (const [i, d] of sheet.drafts.entries()) {
      totalCost = totalCost == null || d.costUsd == null ? null : totalCost + d.costUsd
      if (!source_type) continue
      await logGeneration(supabase, {
        userId: user.id,
        contentType: source_type,
        contentId: source_id ?? null,
        stage: 'image',
        status: 'done',
        meta: { model: sheet.model, usage: undefined, finishReason: 'stop', latencyMs: sheet.latencyMs, costUsd: d.costUsd },
        input: { prompt, lane, size, aspect: aspect ?? null, kind: 'sheet', index: i, quality: sheet.quality, moderation, toggles, rules: buildSafetyRules(toggles, look), look: look ?? null },
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
    }, { status: 201 })
  }

  const startedAt = Date.now()
  let result: GeneratedImage
  try {
    if (mode === 'finalize') {
      if (!draft_filename) {
        return NextResponse.json({ error: 'draft_filename is required to finalize a contact-sheet draft.' }, { status: 400 })
      }
      result = await finalizeFromDraft({
        prompt,
        bucket: 'media',
        size,
        aspect: aspect ?? null,
        toggles,
        lane,
        subject: qaSubject,
        draftFilename: draft_filename,
        discardFilenames: discard_filenames,
        look,
      })
    } else {
      result = await generateImage({
        prompt,
        bucket: 'media',
        size,
        aspect: aspect ?? null,
        premium,
        toggles,
        lane,
        subject: qaSubject,
        moderation,
        look,
      })
    }
  } catch (err) {
    return fail(err)
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
      input: {
        prompt, lane, size, aspect: aspect ?? null, premium, quality: result.quality, moderation,
        toggles, attempts: result.attempts, rules: buildSafetyRules(toggles, look), look: look ?? null,
        ...(mode === 'finalize' ? { kind: 'finalize', draft: draft_filename } : {}),
      },
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
