import OpenAI from 'openai'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'
import { toStorageBody, verifyStoredMagic } from '../storage-body'
import { estimateImageCostUsd, type ImageUsage } from '@/lib/ai/pricing'
import { applyCropNote, applyHouseStyle } from './style'
import { IMAGE_TIERS, tierFor, type ImageTierSpec } from './tiers'
import { buildSafetyRules, type SafetyToggles } from './safety'
import { avoidanceClause, inspectImage, type QaJudgement, type QaReport } from './qa'

export type ImageBucket = 'guide-images' | 'review-images' | 'media'
export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536'
/** Where the image is used. Editorial = hero + body figures: house style, QA, strict rules. */
export type ImageLane = 'editorial' | 'social'
/** Centre-crop the stored file to this ratio; null keeps the API's frame as-is. */
export type ImageAspect = '16:10' | '4:5' | null

// Model + quality per tier live in ./tiers (IMAGE_TIERS) — pinned by hand and
// verified live by `npm run images:check`. `premium` is the request flag: true =
// the Publication tier, the editorial default (he wants the public page at the
// highest quality, and the panels start on it); false = the Draft tier, the
// cheaper knob for roughing out a prompt.

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
  const runQa = args.qa ?? (args.lane === 'editorial')
  const model = `openai/${tier.model}`
  const quality = tier.quality

  // Editorial prompt order: subject, house style, then the crop note (only when
  // the stored file is centre-cropped), all BEFORE the safety rules.
  const styled = args.lane === 'editorial' ? applyHouseStyle(args.prompt) : args.prompt.trim()
  const subjectPrompt = args.lane === 'editorial' && args.aspect ? applyCropNote(styled, args.aspect) : styled
  const rules = buildSafetyRules(args.toggles)
  const fullPrompt = `${subjectPrompt}\n\n${rules}`
  const subject = (args.subject ?? args.prompt).trim()

  let cost: number | null = 0
  const addCost = (c: number | null) => { cost = cost == null || c == null ? null : cost + c }

  let attempts = 0
  let bytes: Buffer
  let qa: GeneratedImage['qa'] = null

  // Attempt 1.
  attempts++
  const first = await callImageModel(client, fullPrompt, size, tier)
  bytes = first.bytes
  addCost(estimateImageCostUsd(model, first.usage))

  if (runQa) {
    const check = await inspectImage({ bytes, mediaType: 'image/webp', subject, toggles: args.toggles })
    addCost(check.meta.costUsd)
    qa = { report: check.report, judgement: check.judgement }

    // One retry on a hard fail, with the reasons as explicit avoidances.
    if (check.judgement.verdict === 'fail') {
      attempts++
      const retryPrompt = `${fullPrompt}\n\n${avoidanceClause(check.judgement.reasons)}`
      const second = await callImageModel(client, retryPrompt, size, tier)
      addCost(estimateImageCostUsd(model, second.usage))
      const recheck = await inspectImage({ bytes: second.bytes, mediaType: 'image/webp', subject, toggles: args.toggles })
      addCost(recheck.meta.costUsd)
      bytes = second.bytes
      qa = { report: recheck.report, judgement: recheck.judgement }
    }
  }

  // Crop to the requested ratio, else keep the API's WebP as-is.
  let width: number
  let height: number
  if (args.aspect) {
    const ratio = ASPECT_RATIO[args.aspect]
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
  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(args.bucket)
    .upload(filename, toStorageBody(bytes, 'image/webp'), { contentType: 'image/webp', upsert: false })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  // Read the header back before handing out a URL. The 2026-07-28 corruption was
  // silent — a stringified body still stores an object with a sane size and the
  // right mimetype — so one range read makes it loud instead, and the bad
  // object is deleted rather than left unrenderable.
  const corruption = await verifyStoredMagic(admin.storage.from(args.bucket), filename, 'image/webp')
  if (corruption) {
    await admin.storage.from(args.bucket).remove([filename]).catch(() => { /* best effort */ })
    console.error(`Image upload verification FAILED for ${args.bucket}/${filename}: ${corruption}`)
    throw new Error('Generated image was corrupted in transit and was discarded. Please try again.')
  }

  const { data: { publicUrl } } = admin.storage.from(args.bucket).getPublicUrl(filename)
  return {
    url: publicUrl,
    bucket: args.bucket,
    filename,
    width,
    height,
    model,
    quality,
    attempts,
    qa,
    costUsd: cost,
    latencyMs: Date.now() - startedAt,
  }
}
