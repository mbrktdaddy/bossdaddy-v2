import OpenAI from 'openai'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'

type Bucket = 'guide-images' | 'review-images' | 'media'
type ImageSize = '1024x1024' | '1536x1024' | '1024x1536'

// Standard tier — cheaper, used as the default for daily editorial generation.
const STANDARD_MODEL: string = 'gpt-image-1'
const STANDARD_QUALITY: 'low' | 'medium' | 'high' | 'auto' = 'medium'

// Premium tier — top-of-line model + high quality, opt-in via the `premium`
// flag from the UI. Reserve for hero shots and cover art.
const PREMIUM_MODEL: string = 'gpt-image-1.5'
const PREMIUM_QUALITY: 'low' | 'medium' | 'high' | 'auto' = 'high'

// WebP quality 90 is visually indistinguishable from the source PNG on
// photo-style content, while reducing file size roughly 10x. Lower values
// start to show artifacts on the smooth gradients in warm-natural-light scenes.
const WEBP_QUALITY = 90

const SAFE_FALLBACK_PROMPT =
  'Photorealistic lifestyle photography, tools and outdoor gear on a wooden surface, warm natural lighting, clean composition, high quality, no people'

let openaiInstance: OpenAI | null = null

function getClient(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openaiInstance
}

function isContentPolicyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'content_policy_violation'
  )
}

async function callImageModel(
  prompt: string,
  size: ImageSize,
  client: OpenAI,
  premium: boolean
): Promise<string> {
  const response = await client.images.generate({
    model: premium ? PREMIUM_MODEL : STANDARD_MODEL,
    prompt,
    n: 1,
    size,
    quality: premium ? PREMIUM_QUALITY : STANDARD_QUALITY,
  })
  const b64 = response.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned from image model')
  return b64
}

export async function generateAndUploadImage(
  prompt: string,
  bucket: Bucket,
  size: ImageSize = '1024x1024',
  premium: boolean = false
): Promise<string> {
  const client = getClient()

  let b64: string
  try {
    b64 = await callImageModel(prompt, size, client, premium)
  } catch (err) {
    if (isContentPolicyError(err)) {
      // Retry with a safe generic prompt rather than failing the whole draft
      b64 = await callImageModel(SAFE_FALLBACK_PROMPT, size, client, premium)
    } else {
      throw err
    }
  }

  const pngBuffer = Buffer.from(b64, 'base64')
  const webpBuffer = await sharp(pngBuffer)
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()

  const filename = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(bucket)
    .upload(filename, webpBuffer, { contentType: 'image/webp', upsert: false })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(filename)
  return publicUrl
}
