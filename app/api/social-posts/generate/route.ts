import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getClaudeClient, MODEL, BOSS_DADDY_SYSTEM } from '@/lib/claude/client'
import { getPlatform, PLATFORM_IDS } from '@/lib/social-platforms'
import { z } from 'zod'

export const maxDuration = 60

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
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // X Studio is admin-only as a FEATURE (RLS stays owner-scoped as defense-in-depth).
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { platform, source_type, source_id, source_title, topic, format } = parsed.data
  const platformConfig = getPlatform(platform)

  // Pull source content summary if review or guide
  let sourceContext = ''
  if (source_type !== 'original' && source_id) {
    if (source_type === 'review') {
      const { data: sourceItem } = await supabase
        .from('reviews')
        .select('title, excerpt, content')
        .eq('id', source_id)
        .single()
      if (sourceItem) {
        const preview = (sourceItem.content as string | null)?.slice(0, 800) ?? ''
        sourceContext = `\n\nSOURCE CONTENT (review):\nTitle: ${sourceItem.title}\nExcerpt: ${sourceItem.excerpt ?? ''}\nContent preview: ${preview}`
      }
    } else {
      const { data: sourceItem } = await supabase
        .from('guides')
        .select('title, excerpt, content')
        .eq('id', source_id)
        .single()
      if (sourceItem) {
        const preview = (sourceItem.content as string | null)?.slice(0, 800) ?? ''
        sourceContext = `\n\nSOURCE CONTENT (guide):\nTitle: ${sourceItem.title}\nExcerpt: ${sourceItem.excerpt ?? ''}\nContent preview: ${preview}`
      }
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
    ? 'This is for X (Twitter). Hook-first. No em-dashes. No hashtag spam — one or two max, only if natural.'
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
- Boss Daddy voice (confident dad, older brother energy, no corporate speak)
- Start each variant with a strong hook — question, bold claim, or punchy statement
- Real-dad specificity — mention actual scenarios, not vague platitudes
- No "game-changer", "must-have", "revolutionary", or "life-changing"
- Each variant must take a different angle or tone (e.g., humor / practical tip / challenge)

Return ONLY a JSON object — no markdown fences, no commentary:
{
  "variants": [
    { "content": "post text here" },
    { "content": "post text here" },
    { "content": "post text here" }
  ]
}`

  const claude = getClaudeClient()
  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: [{ type: 'text', text: BOSS_DADDY_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()

  let variants: { content: string }[]
  try {
    const parsed = JSON.parse(cleaned)
    variants = parsed.variants
  } catch {
    console.error('[social generate] parse error:', cleaned)
    return NextResponse.json({ error: 'Generation failed — bad response format' }, { status: 500 })
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
