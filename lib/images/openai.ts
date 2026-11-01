import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'
import { toStorageBody, verifyStoredMagic } from '../storage-body'
import { estimateImageCostUsd, type ImageUsage } from '@/lib/ai/pricing'
import { applyCropNote, applyLook, applyReferenceNote, type ImageLook } from './style'
import { CONTACT_SHEET, CONTACT_SHEET_COUNT, IMAGE_TIERS, tierFor, type ImageTierSpec } from './tiers'
import { buildSafetyRules, type SafetyToggles } from './safety'
import { avoidanceClause, inspectImage, quotedText, type QaJudgement, type QaReport } from './qa'

export type ImageBucket = 'guide-images' | 'review-images' | 'media'
export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536'
/** Where the image is used. Editorial = hero + body figures: house style, QA, strict rules. */
export type ImageLane = 'editorial' | 'social'
/** Centre-crop the stored file to this ratio; null keeps the API's frame as-is. */
export type ImageAspect = '16:10' | '4:5' | null
/** The Images API's content moderation level. Only `generate` accepts it — `edit` has no such field. */
export type ImageModeration = 'low' | 'auto'

// Model + quality per tier live in ./tiers (IMAGE_TIERS) — pinned by hand and
// verified live by `npm run images:check`. `premium` is the request flag: true =
// the Publication tier, the editorial default (he wants the public page at the
// highest quality, and the panels start on it); false = the Draft tier, the
// cheaper knob for roughing out a prompt.
//
// Two more paths ride the same tiers (./tiers CONTACT_SHEET): a contact sheet is
// three cheap low-quality Draft renders to pick a composition from, and the
// finalize pass re-renders the picked draft on the Publication tier as an image
// edit, so the composition he chose is the one that ships.

// The API encodes WebP itself (`output_format`), so no decode/re-encode pass:
// 90 is visually indistinguishable from PNG on photo-style content and ~10x
// smaller. The only sharp work left is the aspect crop and a header read.
const WEBP_QUALITY = 90

// Stored-file ratios (width / height). Detail-page heroes are 16:10 everywhere
// (the cropper locks uploads to it, the containers are aspect-[16/10]); an AI
// hero is cropped to match at generation so the stored file IS the framing the
// reader sees. 4:5 is the portrait frame: it comes from a 1024x1536 generation,
// so its crop is top and bottom. The prompt is told about the crop up front
// (cropNote in ./style) so the subject lands in the band that survives it.
const ASPECT_RATIO: Record<NonNullable<ImageAspect>, number> = { '16:10': 1.6, '4:5': 0.8 }

// Contact-sheet drafts are scratch files in the destination bucket. The strict
// name shape is what lets the routes accept a filename from the client and the
// cleanup delete by name without ever touching a real asset.
export const SHEET_FILENAME_RE = /^sheet-\d+-[a-z0-9]+-\d\.webp$/

let openaiInstance: OpenAI | null = null
function getClient(): OpenAI {
  if (!openaiInstance) openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openaiInstance
}

/** The model refused the prompt. Surfaced to the author — never swapped for a stock scene. */
export class ImageContentPolicyError extends Error {
  readonly code = 'content_policy' as const
  constructor(readonly prompt: string) {
    super('The image model refused this prompt. Edit the prompt (brands, people, anything graphic) and try again.')
    this.name = 'ImageContentPolicyError'
  }
}

function isContentPolicyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err &&
    (err as { code: unknown }).code === 'content_policy_violation'
}

export interface GenerateImageArgs {
  /** The subject prompt the author sees and edits. Style + rules are appended here. */
  prompt: string
  bucket: ImageBucket
  size?: ImageSize
  premium?: boolean
  toggles: SafetyToggles
  lane: ImageLane
  /** Centre-crop the stored file (heroes: '16:10'; portrait frames: '4:5'). */
  aspect?: ImageAspect
  /** Vision QA + alt text from the pixels. Default: on for editorial, off for social. */
  qa?: boolean
  /** What QA should expect to see when it differs from the prompt. */
  subject?: string
  /** 'low' relaxes the API's content filter (generate only); omitted otherwise. */
  moderation?: ImageModeration
  /** Editorial look: the documentary photograph (default) or an editorial illustration. Ignored on the social lane. */
  look?: ImageLook
}

export interface GeneratedImage {
  url: string
  bucket: ImageBucket
  filename: string
  width: number
  height: number
  /** Gateway-style slug for the generations log, e.g. 'openai/gpt-image-2.5-sunburst'. */
  model: string
  quality: string
  attempts: number
  /** Null when QA did not run (social lane). */
  qa: { report: QaReport; judgement: QaJudgement } | null
  /** Image model + QA, summed; null when the image model is unpriced. */
  costUsd: number | null
  latencyMs: number
}

async function callImageModel(
  client: OpenAI,
  prompt: string,
  size: ImageSize,
  tier: ImageTierSpec,
  moderation?: ImageModeration,
): Promise<{ bytes: Buffer; usage: ImageUsage | undefined }> {
  let response
  try {
    response = await client.images.generate({
      model: tier.model,
      prompt,
      n: 1,
      size,
      quality: tier.quality,
      output_format: 'webp',
      output_compression: WEBP_QUALITY,
      // Sent only when relaxed — 'auto' is the API default, so omitting it keeps
      // the request byte-identical to every pre-sheet call.
      ...(moderation === 'low' ? { moderation: 'low' as const } : {}),
    })
  } catch (err) {
    if (isContentPolicyError(err)) throw new ImageContentPolicyError(prompt)
    throw err
  }
  const b64 = response.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned from image model')
  return { bytes: Buffer.from(b64, 'base64'), usage: response.usage as ImageUsage | undefined }
}

/**
 * Re-render a picked draft on the Publication tier as an image edit. `moderation`
 * is deliberately absent: the SDK's edit params have no such field.
 * `input_fidelity` is deliberately absent too: gpt-image-2.5-sunburst rejects it
 * with a 400 `invalid_input_fidelity_model` (seen 2026-11-01), and the SDK types
 * are a generation behind on that. The draft itself is the reference image; the
 * reference note at the end of the prompt is what holds its composition.
 */
async function callEditModel(
  client: OpenAI,
  prompt: string,
  draft: Buffer,
  size: ImageSize,
): Promise<{ bytes: Buffer; usage: ImageUsage | undefined }> {
  let response
  try {
    response = await client.images.edit({
      model: IMAGE_TIERS.publication.model,
      // A fresh File per call — the upload stream is consumed by the request.
      image: await toFile(draft, 'draft.webp', { type: 'image/webp' }),
      prompt,
      size,
      quality: 'high',
      output_format: 'webp',
      output_compression: WEBP_QUALITY,
    })
  } catch (err) {
    if (isContentPolicyError(err)) throw new ImageContentPolicyError(prompt)
    throw err
  }
  const b64 = response.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned from image model')
  return { bytes: Buffer.from(b64, 'base64'), usage: response.usage as ImageUsage | undefined }
}

/**
 * The full prompt the model sees. Editorial order: subject, house style, then the
 * crop note (only when the stored file is centre-cropped), all BEFORE the safety
 * rules. `subject` is what QA should expect to see.
 */
function buildEditorialPrompt(args: Pick<GenerateImageArgs, 'prompt' | 'lane' | 'aspect' | 'toggles' | 'subject' | 'look'>): { fullPrompt: string; subject: string } {
  const styled = args.lane === 'editorial' ? applyLook(args.prompt, args.look ?? 'photo') : args.prompt.trim()
  const subjectPrompt = args.lane === 'editorial' && args.aspect ? applyCropNote(styled, args.aspect) : styled
  const rules = buildSafetyRules(args.toggles, args.look ?? 'photo')
  return {
    fullPrompt: `${subjectPrompt}\n\n${rules}`,
    subject: (args.subject ?? args.prompt).trim(),
  }
}

/** Upload one WebP and read its header back before anyone gets a URL for it. */
async function uploadVerified(bucket: ImageBucket, filename: string, bytes: Buffer): Promise<string> {
  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(bucket)
    .upload(filename, toStorageBody(bytes, 'image/webp'), { contentType: 'image/webp', upsert: false })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  // Read the header back before handing out a URL. The 2026-07-28 corruption was
  // silent — a stringified body still stores an object with a sane size and the
  // right mimetype — so one range read makes it loud instead, and the bad
  // object is deleted rather than left unrenderable.
  const corruption = await verifyStoredMagic(admin.storage.from(bucket), filename, 'image/webp')
  if (corruption) {
    await admin.storage.from(bucket).remove([filename]).catch(() => { /* best effort */ })
    console.error(`Image upload verification FAILED for ${bucket}/${filename}: ${corruption}`)
    throw new Error('Generated image was corrupted in transit and was discarded. Please try again.')
  }

  const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(filename)
  return publicUrl
}

/** Crop to the requested ratio (else keep the API's WebP as-is), then store + verify. */
async function storeFinal(
  bytes: Buffer,
  aspect: ImageAspect | undefined,
  bucket: ImageBucket,
): Promise<{ url: string; filename: string; width: number; height: number }> {
  let width: number
  let height: number
  if (aspect) {
    const ratio = ASPECT_RATIO[aspect]
    const meta = await sharp(bytes).metadata()
    const srcW = meta.width ?? 0
    const srcH = meta.height ?? 0
    if (!srcW || !srcH) throw new Error('Generated image has no readable dimensions')
    // Crop the longer dimension so nothing is enlarged: 1536x1024 -> 1536x960 for
    // 16:10, 1024x1536 -> 1024x1280 for 4:5 (top and bottom both times).
    if (srcW / srcH > ratio) { height = srcH; width = Math.round(srcH * ratio) }
    else { width = srcW; height = Math.round(srcW / ratio) }
    bytes = await sharp(bytes)
      .resize(width, height, { fit: 'cover', position: 'centre' })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()
  } else {
    const meta = await sharp(bytes).metadata()
    width = meta.width ?? 0
    height = meta.height ?? 0
    if (!width || !height) throw new Error('Generated image has no readable dimensions')
  }

  const filename = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`
  const url = await uploadVerified(bucket, filename, bytes)
  return { url, filename, width, height }
}

/** Vision QA on one render. `expectedText` is the quoted string the prompt asked for, when text is allowed. */
function runQa(bytes: Buffer, subject: string, toggles: SafetyToggles, expectedText: string | null, look: ImageLook) {
  return inspectImage({ bytes, mediaType: 'image/webp', subject, toggles, expectedText, look })
}

/**
 * Generate → (QA, retry once on a hard fail) → crop → store → verify.
 *
 * Nothing is substituted on failure: a content-policy refusal throws
 * `ImageContentPolicyError` for the route to turn into a 422 the panel can act
 * on, and a second QA fail is still stored and RETURNED with its report so the
 * author sees exactly what is wrong (defect #13 was the silent tools-on-wood
 * fallback).
 */
export async function generateImage(args: GenerateImageArgs): Promise<GeneratedImage> {
  const startedAt = Date.now()
  const client = getClient()
  const size = args.size ?? '1024x1024'
  const tier = IMAGE_TIERS[tierFor(args.premium ?? false)]
  const doQa = args.qa ?? (args.lane === 'editorial')
  const model = `openai/${tier.model}`
  const quality = tier.quality

  const { fullPrompt, subject } = buildEditorialPrompt(args)
  const expectedText = args.toggles.noText ? null : quotedText(args.prompt)
  const look = args.look ?? 'photo'

  let cost: number | null = 0
  const addCost = (c: number | null) => { cost = cost == null || c == null ? null : cost + c }

  let attempts = 0
  let bytes: Buffer
  let qa: GeneratedImage['qa'] = null

  // Attempt 1.
  attempts++
  const first = await callImageModel(client, fullPrompt, size, tier, args.moderation)
  bytes = first.bytes
  addCost(estimateImageCostUsd(model, first.usage))

  if (doQa) {
    const check = await runQa(bytes, subject, args.toggles, expectedText, look)
    addCost(check.meta.costUsd)
    qa = { report: check.report, judgement: check.judgement }

    // One retry on a hard fail, with the reasons as explicit avoidances.
    if (check.judgement.verdict === 'fail') {
      attempts++
      const retryPrompt = `${fullPrompt}\n\n${avoidanceClause(check.judgement.reasons)}`
      const second = await callImageModel(client, retryPrompt, size, tier, args.moderation)
      addCost(estimateImageCostUsd(model, second.usage))
      const recheck = await runQa(second.bytes, subject, args.toggles, expectedText, look)
      addCost(recheck.meta.costUsd)
      bytes = second.bytes
      qa = { report: recheck.report, judgement: recheck.judgement }
    }
  }

  const stored = await storeFinal(bytes, args.aspect, args.bucket)
  return {
    url: stored.url,
    bucket: args.bucket,
    filename: stored.filename,
    width: stored.width,
    height: stored.height,
    model,
    quality,
    attempts,
    qa,
    costUsd: cost,
    latencyMs: Date.now() - startedAt,
  }
}

// ── Contact sheet ───────────────────────────────────────────────────────────

export interface SheetDraft {
  url: string
  filename: string
  width: number
  height: number
  costUsd: number | null
}

export interface ContactSheetArgs extends Omit<GenerateImageArgs, 'premium' | 'qa'> {
  /** How many drafts to render; default CONTACT_SHEET_COUNT. */
  count?: number
}

export interface ContactSheetResult {
  drafts: SheetDraft[]
  model: string
  quality: string
  latencyMs: number
}

/**
 * Three cheap drafts to pick a composition from. Parallel low-quality renders on
 * the Draft model — no vision QA (the author IS the QA here) and no crop (the
 * panel previews the crop with CSS; the Publication pass applies the real one).
 * Drafts are stored as-is under `sheet-*` names, and are NOT indexed into
 * media_assets: they are scratch, removed by `finalizeFromDraft` / `discardDrafts`.
 *
 * Partial success is success: if some renders or uploads fail, the ones that
 * worked come back (with a console.warn); only an all-failed sheet throws.
 */
export async function generateContactSheet(args: ContactSheetArgs): Promise<ContactSheetResult> {
  const startedAt = Date.now()
  const client = getClient()
  const size = args.size ?? '1024x1024'
  const count = args.count ?? CONTACT_SHEET_COUNT
  const model = `openai/${CONTACT_SHEET.model}`

  const { fullPrompt } = buildEditorialPrompt(args)

  const renders = await Promise.allSettled(
    Array.from({ length: count }, () => callImageModel(client, fullPrompt, size, CONTACT_SHEET, args.moderation)),
  )
  const rendered: { index: number; bytes: Buffer; costUsd: number | null }[] = []
  const renderErrors: unknown[] = []
  renders.forEach((r, index) => {
    if (r.status === 'fulfilled') rendered.push({ index, bytes: r.value.bytes, costUsd: estimateImageCostUsd(model, r.value.usage) })
    else renderErrors.push(r.reason)
  })
  // Every call failed: surface the first (a content-policy refusal is already an
  // ImageContentPolicyError, so the route turns it into the usual 422).
  if (rendered.length === 0) throw renderErrors[0] ?? new Error('Contact sheet failed')
  if (renderErrors.length) console.warn(`Contact sheet: ${renderErrors.length}/${count} renders failed`, renderErrors[0])

  // One upload failing must not lose the other drafts.
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const uploads = await Promise.allSettled(rendered.map(async (d): Promise<SheetDraft> => {
    const meta = await sharp(d.bytes).metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    if (!width || !height) throw new Error('Generated image has no readable dimensions')
    const filename = `sheet-${stamp}-${d.index}.webp`
    const url = await uploadVerified(args.bucket, filename, d.bytes)
    return { url, filename, width, height, costUsd: d.costUsd }
  }))
  const drafts: SheetDraft[] = []
  const uploadErrors: unknown[] = []
  for (const u of uploads) {
    if (u.status === 'fulfilled') drafts.push(u.value)
    else uploadErrors.push(u.reason)
  }
  if (drafts.length === 0) throw uploadErrors[0] ?? new Error('Contact sheet upload failed')
  if (uploadErrors.length) console.warn(`Contact sheet: ${uploadErrors.length}/${rendered.length} uploads failed`, uploadErrors[0])

  return { drafts, model, quality: CONTACT_SHEET.quality, latencyMs: Date.now() - startedAt }
}

/**
 * Remove scratch drafts. Only `sheet-*` names are ever touched, whatever the
 * caller passes, and a storage failure is logged, never thrown — a leftover
 * scratch file must not fail a render that already succeeded.
 */
export async function discardDrafts(bucket: ImageBucket, filenames: string[]): Promise<void> {
  const names = [...new Set(filenames)].filter(n => SHEET_FILENAME_RE.test(n))
  if (names.length === 0) return
  try {
    const { error } = await createAdminClient().storage.from(bucket).remove(names)
    if (error) console.warn(`discardDrafts: ${bucket} remove failed: ${error.message}`)
  } catch (err) {
    console.warn('discardDrafts failed (non-fatal):', err)
  }
}

export interface FinalizeArgs extends Omit<GenerateImageArgs, 'premium'> {
  /** The picked contact-sheet draft, a `sheet-*` file in `bucket`. */
  draftFilename: string
  /** The other drafts from the same sheet, removed along with the picked one. */
  discardFilenames?: string[]
}

/**
 * Publication render of a picked draft: the draft is attached to an image edit
 * as the reference image, with the reference note appended LAST, so the
 * composition he chose is what ships. QA + one retry work like `generateImage`
 * (the retry is a second edit from the same draft plus the avoidance clause);
 * then the normal crop → store → verify, and the sheet's scratch drafts go.
 */
export async function finalizeFromDraft(args: FinalizeArgs): Promise<GeneratedImage> {
  if (!SHEET_FILENAME_RE.test(args.draftFilename)) throw new Error('Invalid draft filename')
  const startedAt = Date.now()
  const client = getClient()
  const size = args.size ?? '1024x1024'
  const doQa = args.qa ?? (args.lane === 'editorial')
  const model = `openai/${IMAGE_TIERS.publication.model}`

  const { data: blob, error: dlError } = await createAdminClient().storage.from(args.bucket).download(args.draftFilename)
  if (dlError || !blob) throw new Error(`Draft not found or expired: ${dlError?.message ?? args.draftFilename}`)
  const look = args.look ?? 'photo'
  const draft = Buffer.from(await blob.arrayBuffer())

  const { fullPrompt: styledPrompt, subject } = buildEditorialPrompt(args)
  const fullPrompt = applyReferenceNote(styledPrompt, look)
  const expectedText = args.toggles.noText ? null : quotedText(args.prompt)

  let cost: number | null = 0
  const addCost = (c: number | null) => { cost = cost == null || c == null ? null : cost + c }

  let attempts = 0
  let bytes: Buffer
  let qa: GeneratedImage['qa'] = null

  attempts++
  const first = await callEditModel(client, fullPrompt, draft, size)
  bytes = first.bytes
  addCost(estimateImageCostUsd(model, first.usage))

  if (doQa) {
    const check = await runQa(bytes, subject, args.toggles, expectedText, look)
    addCost(check.meta.costUsd)
    qa = { report: check.report, judgement: check.judgement }

    if (check.judgement.verdict === 'fail') {
      attempts++
      const retryPrompt = `${fullPrompt}\n\n${avoidanceClause(check.judgement.reasons)}`
      const second = await callEditModel(client, retryPrompt, draft, size)
      addCost(estimateImageCostUsd(model, second.usage))
      const recheck = await runQa(second.bytes, subject, args.toggles, expectedText, look)
      addCost(recheck.meta.costUsd)
      bytes = second.bytes
      qa = { report: recheck.report, judgement: recheck.judgement }
    }
  }

  const stored = await storeFinal(bytes, args.aspect, args.bucket)
  await discardDrafts(args.bucket, [args.draftFilename, ...(args.discardFilenames ?? [])])

  return {
    url: stored.url,
    bucket: args.bucket,
    filename: stored.filename,
    width: stored.width,
    height: stored.height,
    model,
    quality: IMAGE_TIERS.publication.quality,
    attempts,
    qa,
    costUsd: cost,
    latencyMs: Date.now() - startedAt,
  }
}
