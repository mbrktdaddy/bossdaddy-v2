import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { generateAndUploadImage } from '@/lib/images/dalle'
import { z } from 'zod'

export const maxDuration = 60

const HeroInput = z.object({
  title:         z.string().min(1).max(150),
  category:      z.string().min(1).max(80),
  excerpt:       z.string().max(200).optional().nullable(),
  content_type:  z.enum(['guide', 'review']),
  product_name:  z.string().max(120).optional().nullable(),
  custom_prompt: z.string().max(600).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = HeroInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { title, category, excerpt, content_type, product_name, custom_prompt } = parsed.data

  const prompt = custom_prompt?.trim()
    ? custom_prompt.trim()
    : content_type === 'review'
    ? `Editorial stock photo of the ${product_name ?? title}. ${excerpt ?? ''} Category: ${category}. ` +
      `Product in a realistic real-world setting, natural lighting, clean composition, ` +
      `no people, no text. Style: professional product photography as seen on major review sites.`
    : `Editorial stock photo: ${title}. ${excerpt ?? ''} Category: ${category}. ` +
      `Real-world setting with natural or warm indoor lighting, clean composition, sharp focus, ` +
      `no people, no text, no watermarks. Style: professional lifestyle photography as seen on major content sites.`

  const bucket = content_type === 'review' ? 'review-images' : 'guide-images'

  try {
    const imageUrl = await generateAndUploadImage(prompt, bucket, '1792x1024')
    return NextResponse.json({ imageUrl })
  } catch (err) {
    console.error('Hero image generation error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Image generation failed: ${msg.slice(0, 120)}` }, { status: 502 })
  }
}
