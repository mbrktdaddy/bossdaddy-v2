import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { generateAndUploadImage } from '@/lib/images/openai'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 60

const HeroInput = z.object({
  title:         z.string().min(1).max(150),
  category:      z.string().min(1).max(80),
  excerpt:       z.string().max(200).optional().nullable(),
  content_type:  z.enum(['guide', 'review']),
  product_name:  z.string().max(120).optional().nullable(),
  custom_prompt: z.string().max(600).optional().nullable(),
  premium:       z.boolean().optional().default(false),
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

  const { title, category, excerpt, content_type, custom_prompt, premium } = parsed.data

  // Always avoid replicating specific products / brand packaging — AI hero
  // images are for editorial context only. Owned photography (📷 Take Photo
  // in the workspace) is the right asset for the actual product hero.
  const SAFETY_RULES =
    'Strict rules: NO specific product replicas, NO brand names, NO logos, ' +
    'NO product packaging or labels visible, NO text, NO watermarks, NO trademarks, ' +
    'NO recognizable real-world products. Generate a generic editorial scene only.'

  // basePrompt is the user-facing text (shown back in the UI so admins can tweak it).
  // The full prompt appends SAFETY_RULES which are implementation detail, not shown.
  const basePrompt = custom_prompt?.trim()
    ? custom_prompt.trim()
    : content_type === 'review'
    ? `Editorial lifestyle scene representing the ${category} category. ` +
      `${excerpt ? `Context: ${excerpt}. ` : ''}` +
      `Generic real-world setting suggesting use of items in this category — ` +
      `wooden surface or natural environment, warm natural lighting, soft focus on background props, ` +
      `clean editorial composition, no people. Style: documentary lifestyle photography.`
    : `Editorial scene representing the topic "${title}". ${excerpt ? `Context: ${excerpt}. ` : ''}` +
      `Category: ${category}. Real-world setting with warm natural lighting, clean composition, ` +
      `sharp focus, no people. Style: professional editorial lifestyle photography.`

  const prompt = `${basePrompt}\n\n${SAFETY_RULES}`
  const bucket = content_type === 'review' ? 'review-images' : 'guide-images'

  try {
    const imageUrl = await generateAndUploadImage(prompt, bucket, '1536x1024', premium)
    return NextResponse.json({ imageUrl, promptUsed: basePrompt })
  } catch (err) {
    console.error('Hero image generation error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Image generation failed: ${msg.slice(0, 120)}` }, { status: 502 })
  }
}
