import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { MODEL, OPUS_MODEL } from '@/lib/claude/client'
import { createStructured } from '@/lib/claude/structured'
import { serializeForX } from '@/lib/x/serialize'
import { getPlatform } from '@/lib/social-platforms'
import { checkRateLimit } from '@/lib/rate-limit'
import { requireSocialActor, fetchGenSource } from '@/lib/social/generate'
import { z } from 'zod'

// X Studio Phase 3 — repurpose a published review/guide into X content.
// source → { article, thread, posts }, voice-injected, edge-off-aware.
// Admin-only FEATURE gate (X Studio); RLS on the social_* tables is owner-scoped
// as defense-in-depth. Spend is governed by the operator-approved 10/hr `draft`
// bucket — repurpose is a heavy multi-output generation, same class as a draft.

// A long-form article + thread + posts is a big tool input; allow headroom and
// time like the review-draft endpoint.
export const maxDuration = 180

const X_CHAR_LIMIT = getPlatform('x').charLimit ?? 280

const REPURPOSE_TOOL: Anthropic.Tool = {
  name: 'submit_repurpose',
  description: 'Return the source content repurposed into an X Article, an X thread, and standalone X posts.',
  input_schema: {
    type: 'object',
    properties: {
      article: {
        type: 'object',
        properties: {
          title:     { type: 'string' },
          body_html: { type: 'string' },
        },
        required: ['title', 'body_html'],
      },
      thread: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          posts: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'posts'],
      },
      posts: { type: 'array', items: { type: 'string' } },
    },
    required: ['article', 'thread', 'posts'],
  },
}

const RepurposeInput = z.object({
  source_type: z.enum(['review', 'guide']),
  source_id:   z.string().uuid(),
  // Optional angle nudge (e.g. "lead with the budget angle").
  instruction: z.string().max(500).optional().nullable(),
  // Generation model — sonnet (fast, default) or opus (best, opt-in). Both run
  // under the same 10/hr draft cap.
  model:       z.enum(['sonnet', 'opus']).optional().default('sonnet'),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const actor = await requireSocialActor(supabase) // admin-only feature gate
  if (actor.error) return actor.error
  const user = actor.user

  // Operator-approved 10/hr draft cap — do not raise without approval.
  const { success, remaining, reset } = await checkRateLimit(`draft:${user.id}`)
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. You can generate 10 drafts per hour.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining), 'X-RateLimit-Reset': String(reset) } },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = RepurposeInput.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { source_type, source_id, instruction, model } = parsed.data

  const src = await fetchGenSource(source_type, source_id)
  if (!src) return NextResponse.json({ error: 'Source content not found' }, { status: 404 })

  // Cap so a long article doesn't blow the input budget.
  const plainContent = src.bodyText.slice(0, 4000)

  const sourceBlock = source_type === 'review'
    ? `Source review:
Title: ${src.title}
Product: ${src.productName ?? ''}
Category: ${src.category ?? ''}
Rating: ${src.rating ?? ''}/10
URL: ${src.url}
Excerpt: ${src.excerpt ?? ''}
Content: ${plainContent}`
    : `Source guide:
Title: ${src.title}
Category: ${src.category ?? ''}
URL: ${src.url}
Excerpt: ${src.excerpt ?? ''}
Content: ${plainContent}`

  const prompt = `Repurpose this published ${source_type} into X.com content in the Boss Daddy voice.

${sourceBlock}
${instruction ? `\nANGLE: ${instruction}\n` : ''}
Return all three via the submit_repurpose tool:

1) article — a long-form X Article.
   - title: punchy, no clickbait, ≤ 80 chars.
   - body_html: 400–700 words of SIMPLE HTML. Allowed tags ONLY: <p>, <h2>, <ul>/<ol>/<li>, <blockquote>, <strong>, <em>, <a href="...">. NO tables, images, <div>, classes, or inline styles (X strips them). First-person dad voice. Link back to the source once with a single <a href="${src.url}">. Do NOT use [[BUY:...]] tokens or raw product URLs.

2) thread — an X thread.
   - title: a short internal label (not posted).
   - posts: 4–7 posts, each ≤ ${X_CHAR_LIMIT} characters. Post 1 is a scroll-stopping hook. Do NOT number the posts — the UI adds 1/n. At most one hashtag total, only if natural. No em-dashes.

3) posts — 3 standalone X posts, each ≤ ${X_CHAR_LIMIT} characters, each a DIFFERENT angle (practical tip / bold take / honest question). Hook-first. No em-dashes, no hashtag spam.

EDGE OFF: if the source covers loss, mental health, marriage strain, or safety-critical topics (car seats, infant sleep, water safety, firearms), drop the roast and smirk — write in warm Protector mode per the voice rules.
Never use "game-changer", "must-have", "revolutionary", or "life-changing". No corporate speak.`

  const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)

  let result
  try {
    result = await createStructured({
      system: systemBlocks,
      messages: [{ role: 'user', content: prompt }],
      tool: REPURPOSE_TOOL,
      model: model === 'opus' ? OPUS_MODEL : MODEL,
      // Article (400–700 words) + thread + 3 posts is a large tool input.
      maxTokens: 6000,
      maxRetries: 3,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Claude API error (repurpose):', msg)
    const isTimeout  = /timeout|timed.?out|deadline/i.test(msg)
    const isOverload = /overload|529|capacity/i.test(msg)
    return NextResponse.json({
      error: isTimeout
        ? 'Generation timed out — the AI is busy. Please wait a moment and try again.'
        : isOverload
        ? 'The AI service is currently overloaded. Please try again in a minute.'
        : `AI service error: ${msg.slice(0, 120)}`,
    }, { status: 502 })
  }

  if (result.stopReason === 'max_tokens') {
    console.error('repurpose hit max_tokens — output truncated')
    return NextResponse.json({ error: 'The output ran long and got cut off. Try again.' }, { status: 502 })
  }

  const data = result.data
  if (!data) return NextResponse.json({ error: 'AI returned an unexpected format — please try again.' }, { status: 502 })

  const article = data.article as { title?: string; body_html?: string } | undefined
  const thread  = data.thread  as { title?: string; posts?: string[] } | undefined
  const posts   = Array.isArray(data.posts) ? (data.posts as string[]) : []

  // Run the article through the X-safe serializer (Phase 2) so the workspace can
  // warn about anything X would silently strip before the author pastes it.
  const { html: x_html, dropped } = serializeForX(article?.body_html ?? '')

  return NextResponse.json({
    repurpose: {
      article: {
        title:     article?.title ?? src.title ?? '',
        body_html: article?.body_html ?? '',
        x_html,
        dropped,
      },
      thread: {
        title: thread?.title ?? '',
        posts: Array.isArray(thread?.posts) ? thread!.posts : [],
      },
      posts,
    },
    source_title: src.title,
    remaining,
  })
}
