import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { createStructured } from '@/lib/claude/structured'
import { checkRateLimit } from '@/lib/rate-limit'
import { OCCASIONS } from '@/lib/gift-occasions'
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

// Public URL segment per collection type — mirrors getPublicPath() in
// CollectionWorkspace.tsx and the revalidate mapping in the picks PATCH route.
function collectionPublicPath(type: string | null, slug: string, occasion: string | null): string {
  if (type === 'gift_guide') {
    const occ = OCCASIONS.find((o) => o.value === occasion)
    return occ ? `/gifts/${occ.slug}` : `/picks/${slug}`
  }
  if (type === 'comparison') return `/comparisons/${slug}`
  if (type === 'stack')      return `/stacks/${slug}`
  return `/picks/${slug}` // general, best_of
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { success } = await checkRateLimit(`social-copy:${user.id}`, 'claude-aux')
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded — try again shortly.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { content_type, content_id, platforms, instruction } = parsed.data

  // Fetch the source content. Collections alias description→excerpt and
  // intro_html→content so the downstream prompt code stays content-type-agnostic.
  const admin = createAdminClient()
  const table = content_type === 'review' ? 'reviews' : content_type === 'collection' ? 'collections' : 'guides'
  const fields =
    content_type === 'review'
      ? 'title, product_name, category, excerpt, content, rating, slug'
      : content_type === 'collection'
      ? 'title, excerpt:description, content:intro_html, slug, collection_type, occasion'
      : 'title, category, excerpt, content, slug'

  const { data: source } = await admin.from(table).select(fields).eq('id', content_id).single()
  if (!source) return NextResponse.json({ error: 'Content not found' }, { status: 404 })

  const src = source as unknown as Record<string, string | number | null>
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const url = content_type === 'collection'
    ? `${siteUrl}${collectionPublicPath(src.collection_type as string | null, String(src.slug ?? ''), src.occasion as string | null)}`
    : `${siteUrl}/${content_type}s/${src.slug}`

  // Strip HTML for the prompt
  const plainContent = typeof src.content === 'string'
    ? src.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : ''

  const platformBlocks = platforms.map((p) => {
    const spec = PLATFORM_SPEC[p]
    return `### ${spec.label} (${p})\nRules: ${spec.rules}`
  }).join('\n\n')

  const sourceBlock =
    content_type === 'review'
      ? `Source review:
Title: ${src.title}
Product: ${src.product_name}
Category: ${src.category}
Rating: ${src.rating}/10
URL: ${url}
Excerpt: ${src.excerpt ?? '(none)'}

Body (truncated): ${plainContent.slice(0, 1500)}`
      : content_type === 'collection'
      ? `Source collection (a curated roundup of gear):
Title: ${src.title}
URL: ${url}
Summary: ${src.excerpt ?? '(none)'}

Intro (truncated): ${plainContent.slice(0, 1500)}`
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

Each platform's post should feel native to that platform, not a copy-paste. Return your result by calling the submit_social_posts tool, with one entry per requested platform in the same order. Each entry: platform (e.g. "twitter"), body (the post text, may span lines), and hashtags (relevant tags for that platform — Instagram needs more, Twitter needs fewer, LinkedIn often none).

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

  // platform check uses 'x' internally; route accepts 'twitter' for backwards compat
  const PLATFORM_MAP: Record<string, string> = { twitter: 'x' }
  const DB_PLATFORMS = ['x', 'instagram', 'threads', 'facebook']

  const rows = drafts
    .filter((d) => d.platform && d.body && platforms.includes(d.platform as typeof platforms[number]))
    .map((d) => {
      const platform = PLATFORM_MAP[d.platform] ?? d.platform
      const tags: string[] = Array.isArray(d.hashtags) ? d.hashtags.slice(0, 30).map(String) : []
      const content = tags.length > 0 ? `${d.body}\n\n${tags.join(' ')}` : d.body
      return { platform, content, source_type: content_type, source_id: content_id, user_id: user.id, status: 'draft' as const }
    })
    .filter((r) => DB_PLATFORMS.includes(r.platform))

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid posts returned' }, { status: 502 })
  }

  const { data: saved, error: dbError } = await admin
    .from('social_posts')
    .insert(rows)
    .select('platform, content, status')

  if (dbError) {
    console.error('social-copy save error:', dbError)
    return NextResponse.json({ error: 'Saved drafts to memory but DB insert failed', drafts }, { status: 500 })
  }

  return NextResponse.json({ posts: saved ?? rows })
}
