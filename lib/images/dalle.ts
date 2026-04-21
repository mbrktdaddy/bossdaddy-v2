import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'

type Bucket = 'article-images' | 'review-images'
type ImageSize = '1024x1024' | '1792x1024'

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

async function callDallE(
  prompt: string,
  size: ImageSize,
  client: OpenAI
): Promise<string> {
  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size,
    quality: 'standard',
    style: 'natural',
    response_format: 'b64_json',
  })
  const b64 = response.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned from DALL-E')
  return b64
}

export async function generateAndUploadImage(
  prompt: string,
  bucket: Bucket,
  size: ImageSize = '1024x1024'
): Promise<string> {
  const client = getClient()

  let b64: string
  try {
    b64 = await callDallE(prompt, size, client)
  } catch (err) {
    if (isContentPolicyError(err)) {
      // Retry with a safe generic prompt rather than failing the whole draft
      b64 = await callDallE(SAFE_FALLBACK_PROMPT, size, client)
    } else {
      throw err
    }
  }

  const buffer = Buffer.from(b64, 'base64')
  const filename = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(bucket)
    .upload(filename, buffer, { contentType: 'image/png', upsert: false })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(filename)
  return publicUrl
}
