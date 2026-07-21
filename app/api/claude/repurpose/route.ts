import { NextResponse, type NextRequest } from 'next/server'
import { jsonSchema } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { buildBossDaddySystemMessages } from '@/lib/voiceProfile'
import { MODELS } from '@/lib/ai/models'
import { aiGenerateObject } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
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

type RepurposePayload = {
  article?: { title?: string; body_html?: string }
  thread?:  { title?: string; posts?: string[] }
  posts?:   string[]
}

// The model output is validated against this schema — the SDK enforces it
// instead of us regex-parsing JSON from text.
const REPURPOSE_SCHEMA = jsonSchema<RepurposePayload>({
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
})

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

X FORMATTING & READABILITY (applies to every thread post and standalone post):
- Break within the post. Use line breaks (\\n) and blank lines to separate ideas — a hook line, a blank line, then the payoff. Never a dense wall of text. Short lines read better on a phone.
- Emoji: 0–1 per post, and only when it earns its place (warmth or a single clear signal). NEVER 🚀 🔥 💯 or hype-cluster emoji. Most posts should use zero.
- CAPS: allowed for ONE word of emphasis at most, sparingly (it echoes the wordmark). Never a full sentence or phrase in caps — it reads as shouting.

EDGE OFF: if the source covers loss, mental health, marriage strain, or safety-critical topics (car seats, infant sleep, water safety, firearms), drop the roast and smirk — write in warm Protector mode per the voice rules.
Never use "game-changer", "must-have", "revolutionary", or "life-changing". No corporate speak.`

  const systemMessages = await buildBossDaddySystemMessages(supabase, user.id)

  // The sonnet/opus tier picker maps to a concrete Claude model (explicit
  // per-request override), NOT the content-bucket default — repurpose gives the
  // operator a deliberate quality/speed choice. Still gets automatic Claude
  // fallback via the wrapper.
  let data: RepurposePayload
  try {
    data = await aiGenerateObject<RepurposePayload>({
      bucket: 'content',
      tag: 'repurpose',
      model: model === 'opus' ? MODELS.claudeOpus : MODELS.claudeSonnet,
      schema: REPURPOSE_SCHEMA,
      system: systemMessages,
      messages: [{ role: 'user', content: prompt }],
      // Article (400–700 words) + thread + 3 posts is a large output.
      maxOutputTokens: 6000,
      temperature: 0.8,
      maxRetries: 3,
    })
  } catch (err: unknown) {
    const c = classifyClaudeError(err)
    console.error('repurpose generation error:', c.kind, '-', c.detail)
    if (c.kind === 'truncated') {
      return NextResponse.json({ error: 'The output ran long and got cut off. Try again.' }, { status: 502 })
    }
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }

  const article = data.article
  const thread  = data.thread
  const posts   = Array.isArray(data.posts) ? data.posts : []

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
        posts: Array.isArray(thread?.posts) ? thread.posts : [],
      },
      posts,
    },
    source_title: src.title,
    // Carried over so the workspace can default the post/article image to the
    // source's existing hero (reference — no copy). Author can swap or clear it.
    source_image_url: src.imageUrl,
    remaining,
  })
}
