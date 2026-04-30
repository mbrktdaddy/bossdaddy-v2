import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { z } from 'zod'

export const maxDuration = 45

const Schema = z.object({
  content_type: z.enum(['guide', 'review']),
  content_id:   z.string().uuid(),
  // Platforms to generate for
  platforms:    z.array(z.enum(['twitter', 'instagram', 'facebook', 'linkedin', 'threads'])).min(1).max(5),
  // Optional: if user wants to nudge the angle
  instruction:  z.string().max(500).optional().nullable(),
})

const PLATFORM_SPEC: Record<string, { label: string; rules: string }> = {
  twitter: {
    label: 'Twitter/X',
    rules: '280 char hard limit including hashtags. Open with a hook in the first line. End with a one-line CTA.',
  },
  instagram: {
    label: 'Instagram',
    rules: 'Caption-style. 1–3 short paragraphs. Conversational. Include 5–10 relevant hashtags at the end (separate from body).',
  },
  facebook: {
    label: 'Facebook',
    rules: 'Conversational, 2–4 sentences. Slightly longer than Twitter. End with a question to drive engagement.',
  },
  linkedin: {
    label: 'LinkedIn',
    rules: 'More professional but still personal. 3–5 short paragraphs. Lead with a takeaway insight, not the product.',
  },
  threads: {
    label: 'Threads',
    rules: '1–2 short paragraphs. Conversational, like Twitter but with more breathing room. 500 char comfortable max.',
  },
}

interface SocialDraft {
  platform: string
  body: string
  hashtags: string[]
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { content_type, content_id, platforms, instruction } = parsed.data

  // Fetch the source content
  const admin = createAdminClient()
  const table = content_type === 'review' ? 'reviews' : 'articles'
  const fields = content_type === 'review'
    ? 'title, product_name, category, excerpt, content, rating, slug'
    : 'title, category, excerpt, content, slug'

  const { data: source } = await admin.from(table).select(fields).eq('id', content_id).single()
  if (!source) return NextResponse.json({ error: 'Content not found' }, { status: 404 })

  const src = source as unknown as Record<string, string | number | null>
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const url = `${siteUrl}/${content_type}s/${src.slug}`

  // Strip HTML for the prompt
  const plainContent = typeof src.content === 'string'
    ? src.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : ''

  const platformBlocks = platforms.map((p) => {
    const spec = PLATFORM_SPEC[p]
    return `### ${spec.label} (${p})\nRules: ${spec.rules}`
  }).join('\n\n')

  const sourceBlock = content_type === 'review'
    ? `Source review:
Title: ${src.title}
Product: ${src.product_name}
Category: ${src.category}
Rating: ${src.rating}/10
URL: ${url}
Excerpt: ${src.excerpt ?? '(none)'}

Body (truncated): ${plainContent.slice(0, 1500)}`
    : `Source article:
Title: ${src.title}
Category: ${src.category}
URL: ${url}
Excerpt: ${src.excerpt ?? '(none)'}

Body (truncated): ${plainContent.slice(0, 1500)}`

  const userInstruction = instruction?.trim()
    ? `\n\nUser nudge: ${instruction}`
    : ''

  const prompt = `${sourceBlock}

Generate native social media copy for the following platforms.${userInstruction}

${platformBlocks}

Voice: Boss Daddy — first-person dad, direct, no corporate fluff, no "game-changer" / "must-have" cliches. Each platform's post should feel native to that platform, not a copy-paste.

Return JSON exactly matching this shape, with one entry per requested platform in the same order:
{
  "posts": [
    {
      "platform": "twitter",
      "body": "Post text here. May span lines.",
      "hashtags": ["BossDaddy", "DadLife"]
    }
  ]
}

Hashtags should be the relevant tags for that platform (Instagram needs more, Twitter needs fewer, LinkedIn often none). Body should NOT include the hashtags themselves; we list them separately. Always include the URL exactly once at the end of the body.

Return ONLY the JSON. No markdown, no preamble.`

  const claude = getClaudeClient()

  let json: { posts?: SocialDraft[] } = {}
  try {
    const res = await claude.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [{
        type: 'text' as const,
        text: 'You are a social media copywriter for Boss Daddy. You produce platform-native posts that match the writer\'s direct, no-fluff dad voice.',
        cache_control: { type: 'ephemeral' as const },
      }],
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (res.content.find((b) => b.type === 'text')?.text ?? '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    json = JSON.parse(text)
  } catch (err) {
    console.error('social-copy generation error:', err)
    return NextResponse.json({ error: 'Generation failed — try again' }, { status: 502 })
  }

  const drafts = Array.isArray(json.posts) ? json.posts : []
  if (drafts.length === 0) {
    return NextResponse.json({ error: 'No posts returned' }, { status: 502 })
  }

  // Upsert each post
  const rows = drafts
    .filter((d) => d.platform && d.body && platforms.includes(d.platform as typeof platforms[number]))
    .map((d) => ({
      content_type,
      content_id,
      platform: d.platform,
      body: d.body,
      hashtags: Array.isArray(d.hashtags) ? d.hashtags.slice(0, 30).map(String) : [],
      generated_by: user.id,
      generated_at: new Date().toISOString(),
    }))

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid posts returned' }, { status: 502 })
  }

  const { data: saved, error: dbError } = await admin
    .from('social_posts')
    .upsert(rows, { onConflict: 'content_type,content_id,platform' })
    .select('platform, body, hashtags, generated_at')

  if (dbError) {
    console.error('social-copy save error:', dbError)
    return NextResponse.json({ error: 'Saved drafts to memory but DB upsert failed', drafts }, { status: 500 })
  }

  return NextResponse.json({ posts: saved ?? rows })
}
