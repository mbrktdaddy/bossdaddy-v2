import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { createStructured } from '@/lib/claude/structured'
import { checkRateLimit } from '@/lib/rate-limit'
import { PLATFORM_IDS, type SocialPlatform } from '@/lib/social-platforms'
import { requireSocialActor, fetchGenSource } from '@/lib/social/generate'
import { z } from 'zod'

export const maxDuration = 45

// The model returns the posts by calling this tool — its input_schema is the
// shape, so the SDK validates it instead of us regex-parsing JSON.
const POSTS_TOOL: Anthropic.Tool = {
  name: 'submit_social_posts',
  description: 'Return one native social post per requested platform.',
  input_schema: {
    type: 'object',
    properties: {
      posts: { type: 'array', items: {
        type: 'object',
        properties: {
          platform: { type: 'string' },
          body:     { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
        },
        required: ['platform', 'body', 'hashtags'],
      } },
    },
    required: ['posts'],
  },
}

const Schema = z.object({
  content_type: z.enum(['guide', 'review', 'collection']),
  content_id:   z.string().uuid(),
  // Platforms to generate for — the canonical X-Studio vocabulary ('x', not 'twitter').
  platforms:    z.array(z.enum(PLATFORM_IDS as [SocialPlatform, ...SocialPlatform[]])).min(1).max(4),
  // Optional: if user wants to nudge the angle
  instruction:  z.string().max(500).optional().nullable(),
})

const PLATFORM_SPEC: Record<SocialPlatform, { label: string; rules: string }> = {
  x: {
    label: 'X',
    rules: '280 char hard limit including hashtags. Open with a hook in the first line. End with a one-line CTA.',
  },
  instagram: {
    label: 'Instagram',
    rules: 'Caption-style. 1–3 short paragraphs. Conversational. Include 5–10 relevant hashtags at the end (separate from body).',
  },
  facebook: {
    label: 'Facebook',
    rules: 'Conversational, 2–4 sentences. Slightly longer than an X post. End with a question to drive engagement.',
  },
  threads: {
    label: 'Threads',
    rules: '1–2 short paragraphs. Conversational, like X but with more breathing room. 500 char comfortable max.',
  },
}

interface SocialDraft {
  platform: string
  body: string
  hashtags: string[]
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  // Embedded in the review/guide/collection workspaces → admins AND authors.
  const actor = await requireSocialActor(supabase, { authorsAllowed: true })
  if (actor.error) return actor.error
  const user = actor.user

  const { success } = await checkRateLimit(`social-copy:${user.id}`, 'claude-aux')
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded — try again shortly.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { content_type, content_id, platforms, instruction } = parsed.data

  const src = await fetchGenSource(content_type, content_id)
  if (!src) return NextResponse.json({ error: 'Content not found' }, { status: 404 })

  const platformBlocks = platforms.map((p) => {
    const spec = PLATFORM_SPEC[p]
    return `### ${spec.label} (${p})\nRules: ${spec.rules}`
  }).join('\n\n')

  const sourceBlock =
    content_type === 'review'
      ? `Source review:
Title: ${src.title}
Product: ${src.productName ?? ''}
Category: ${src.category ?? ''}
Rating: ${src.rating ?? ''}/10
URL: ${src.url}
Excerpt: ${src.excerpt ?? '(none)'}

Body (truncated): ${src.bodyText.slice(0, 1500)}`
      : content_type === 'collection'
      ? `Source collection (a curated roundup of gear):
Title: ${src.title}
URL: ${src.url}
Summary: ${src.excerpt ?? '(none)'}

Intro (truncated): ${src.bodyText.slice(0, 1500)}`
      : `Source article:
Title: ${src.title}
Category: ${src.category ?? ''}
URL: ${src.url}
Excerpt: ${src.excerpt ?? '(none)'}

Body (truncated): ${src.bodyText.slice(0, 1500)}`

  const userInstruction = instruction?.trim()
    ? `\n\nUser nudge: ${instruction}`
    : ''

  const prompt = `${sourceBlock}

Generate native social media copy for the following platforms.${userInstruction}

${platformBlocks}

Each platform's post should feel native to that platform, not a copy-paste. Return your result by calling the submit_social_posts tool, with one entry per requested platform in the same order. Each entry: platform (e.g. "x"), body (the post text, may span lines), and hashtags (relevant tags for that platform — Instagram needs more, X needs fewer).

Body should NOT include the hashtags themselves; we list them separately. Always include the URL exactly once at the end of the body.`

  let result
  try {
    const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)
    result = await createStructured({
      system: systemBlocks,
      messages: [{ role: 'user', content: prompt }],
      tool: POSTS_TOOL,
      maxTokens: 1500,
    })
  } catch (err) {
    console.error('social-copy generation error:', err)
    return NextResponse.json({ error: 'Generation failed — try again' }, { status: 502 })
  }

  if (result.stopReason === 'max_tokens') {
    return NextResponse.json({ error: 'The copy ran long and got cut off. Try fewer platforms and regenerate.' }, { status: 502 })
  }

  const json = (result.data ?? {}) as { posts?: SocialDraft[] }
  const drafts = Array.isArray(json.posts) ? json.posts : []
  if (drafts.length === 0) {
    return NextResponse.json({ error: 'No posts returned' }, { status: 502 })
  }

  const rows = drafts
    .filter((d) => d.platform && d.body && (PLATFORM_IDS as string[]).includes(d.platform) && platforms.includes(d.platform as SocialPlatform))
    .map((d) => {
      const tags: string[] = Array.isArray(d.hashtags) ? d.hashtags.slice(0, 30).map(String) : []
      const content = tags.length > 0 ? `${d.body}\n\n${tags.join(' ')}` : d.body
      return { platform: d.platform, content, source_type: content_type, source_id: content_id, user_id: user.id, status: 'draft' as const }
    })

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid posts returned' }, { status: 502 })
  }

  const admin = createAdminClient()

  // Overwrite semantics: the embedded panel promises "regenerating replaces the
  // selected platforms". social_posts is insert-only, so we clear this content's
  // existing posts for the platforms we just regenerated before inserting the
  // fresh ones — keeps one row per (content, platform) and avoids duplicate pileup.
  const regenPlatforms = [...new Set(rows.map((r) => r.platform))]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('social_posts')
    .delete()
    .eq('user_id', user.id)
    .eq('source_type', content_type)
    .eq('source_id', content_id)
    .in('platform', regenPlatforms)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: saved, error: dbError } = await (admin as any)
    .from('social_posts')
    .insert(rows)
    .select('id, platform, content, status, source_type, source_id')

  if (dbError) {
    console.error('social-copy save error:', dbError)
    return NextResponse.json({ error: 'Saved drafts to memory but DB insert failed', drafts }, { status: 500 })
  }

  return NextResponse.json({ posts: saved ?? rows })
}
