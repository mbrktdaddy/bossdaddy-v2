import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { createStructured } from '@/lib/claude/structured'
import { getPlatform, PLATFORM_IDS } from '@/lib/social-platforms'
import { checkRateLimit } from '@/lib/rate-limit'
import { requireSocialActor, fetchGenSource, type GenSourceType } from '@/lib/social/generate'
import { z } from 'zod'

export const maxDuration = 60

// The model returns the variants by calling this tool — its input_schema is the
// shape, so the SDK validates it instead of us regex-parsing "JSON only" prose.
const VARIANTS_TOOL: Anthropic.Tool = {
  name: 'submit_variants',
  description: 'Return 3 distinct social post variants for the requested platform.',
  input_schema: {
    type: 'object',
    properties: {
      variants: {
        type: 'array',
        items: {
          type: 'object',
          properties: { content: { type: 'string' } },
          required: ['content'],
        },
      },
    },
    required: ['variants'],
  },
}

const GenerateSchema = z.object({
  platform:     z.enum(PLATFORM_IDS as [string, ...string[]]),
  source_type:  z.enum(['review', 'guide', 'original', 'collection']),
  source_id:    z.string().uuid().optional(),
  source_title: z.string().max(300).optional(),
  topic:        z.string().max(500).optional(),
  format:       z.enum(['single', 'thread']).default('single'),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const actor = await requireSocialActor(supabase) // admin-only feature gate
  if (actor.error) return actor.error
  const user = actor.user

  // Operator-approved 10/hr draft cap — same class as a draft generation.
  const { success, remaining, reset } = await checkRateLimit(`draft:${user.id}`)
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. You can generate 10 drafts per hour.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining), 'X-RateLimit-Reset': String(reset) } },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { platform, source_type, source_id, source_title, topic, format } = parsed.data
  const platformConfig = getPlatform(platform)

  // Pull a source summary for review / guide / collection; fall back to a raw topic.
  let sourceContext = ''
  if (source_type !== 'original' && source_id) {
    const src = await fetchGenSource(source_type as GenSourceType, source_id)
    if (src) {
      sourceContext = `\n\nSOURCE CONTENT (${src.type}):\nTitle: ${src.title}\nExcerpt: ${src.excerpt ?? ''}\nContent preview: ${src.bodyText.slice(0, 800)}`
    }
  } else if (topic) {
    sourceContext = `\n\nTOPIC: ${topic}`
  }

  const charNote = platformConfig.charLimit
    ? `Each post MUST be under ${platformConfig.charLimit} characters.`
    : 'No hard character limit — write what feels right.'

  const formatNote = format === 'thread'
    ? 'Write a thread of 3–4 connected posts. Separate each post with "---".'
    : 'Write a single standalone post.'

  const platformNote = platform === 'x'
    ? 'This is for X. Hook-first. No em-dashes. No hashtag spam — one or two max, only if natural.'
    : platform === 'instagram'
    ? 'This is for Instagram. Can be longer. End with 5–10 relevant hashtags on a new line.'
    : platform === 'threads'
    ? 'This is for Threads. Conversational tone. Hashtags optional and minimal.'
    : 'This is for Facebook. Warm and direct. No hashtags needed.'

  const userPrompt = `Generate 3 distinct social media post variants for Boss Daddy Life.

PLATFORM: ${platformConfig.label}
${platformNote}
${charNote}
${formatNote}
${sourceContext}

Rules:
- Start each variant with a strong hook — question, bold claim, or punchy statement
- Real-dad specificity — mention actual scenarios, not vague platitudes
- No "game-changer", "must-have", "revolutionary", or "life-changing"
- Each variant must take a different angle or tone (e.g., humor / practical tip / challenge)

Return the 3 variants via the submit_variants tool.`

  let result
  try {
    const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)
    result = await createStructured({
      system: systemBlocks,
      messages: [{ role: 'user', content: userPrompt }],
      tool: VARIANTS_TOOL,
      maxTokens: 1500,
    })
  } catch (err) {
    console.error('[social generate] Claude error:', err)
    return NextResponse.json({ error: 'Generation failed — try again' }, { status: 502 })
  }

  if (result.stopReason === 'max_tokens') {
    return NextResponse.json({ error: 'The output ran long and got cut off. Try again.' }, { status: 502 })
  }

  const variants = Array.isArray((result.data as { variants?: { content: string }[] } | null)?.variants)
    ? (result.data as { variants: { content: string }[] }).variants
    : []
  if (variants.length === 0) {
    return NextResponse.json({ error: 'AI returned an unexpected format — please try again.' }, { status: 502 })
  }

  return NextResponse.json({
    variants,
    platform,
    source_type,
    source_id:    source_id ?? null,
    source_title: source_title ?? topic ?? null,
    format,
  })
}
