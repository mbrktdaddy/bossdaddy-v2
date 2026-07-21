import { NextResponse, type NextRequest } from 'next/server'
import { jsonSchema } from 'ai'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildBossDaddySystemMessages } from '@/lib/voiceProfile'
import { aiGenerateObject } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 60

// Loosely-typed model output — the downstream .map/.filter defensively coerces
// every field, so the shape only needs to be optional-everywhere.
type Payload = {
  blurbs?: Array<{ id?: unknown; blurb?: unknown }>
  roleLabels?: Array<{ id?: unknown; label?: unknown }>
  faqs?: Array<{ question?: unknown; answer?: unknown }>
}

// The model output is validated against this schema — the SDK enforces it
// instead of us regex-parsing JSON from text.
const FILL_SCHEMA = jsonSchema<Payload>({
  type: 'object',
  properties: {
    blurbs: { type: 'array', items: {
      type: 'object',
      properties: { id: { type: 'string' }, blurb: { type: 'string' } },
      required: ['id', 'blurb'],
    } },
    roleLabels: { type: 'array', items: {
      type: 'object',
      properties: { id: { type: 'string' }, label: { type: 'string' } },
      required: ['id', 'label'],
    } },
    faqs: { type: 'array', items: {
      type: 'object',
      properties: { question: { type: 'string' }, answer: { type: 'string' } },
      required: ['question', 'answer'],
    } },
  },
  required: ['blurbs', 'faqs'],
})

const Input = z.object({
  collectionType: z.enum(['general', 'best_of', 'gift_guide', 'comparison', 'stack']),
  title:          z.string().min(2).max(160),
  description:    z.string().max(500).optional().nullable(),
  itemReviewIds:  z.array(z.string().uuid()).min(1).max(20),
})

// Per-flavor briefs that steer the role-label suggestions and the FAQ set.
// Comparison uses `wins_category` instead of `role_label`, so we tell Claude
// not to return role labels for that flavor.
const FLAVOR_GUIDANCE: Record<string, { roleLabel: string | null; faqTopics: string[] }> = {
  gift_guide: {
    roleLabel: 'A short gift-context tag — "For the New Dad", "Splurge Pick", "Under $25", "Last-Minute Save", "Stocking Stuffer". 2-4 words. Title Case. Tie to who would receive it or why it slots into THIS gift list, not generic product traits.',
    faqTopics: [
      'How to pick the right one for a specific dad',
      'Whether the picks ship in time',
      'Are these all under a certain budget',
      'What if dad already has gear in this category',
      'How to gift without spoiling the surprise',
    ],
  },
  best_of: {
    roleLabel: 'A "Best [X]" superlative — "Best Overall", "Best Budget", "Best for Beginners", "Best for Heavy Use", "Most Versatile". 2-4 words. Title Case. Exactly one "Best Overall" across the list — the top-rated pick gets it.',
    faqTopics: [
      'Why these specific picks made the list',
      'What was tested and what didn\'t make the cut',
      'How long the testing window was',
      'When the list will be refreshed',
      'Who shouldn\'t buy any of these',
    ],
  },
  general: {
    roleLabel: 'A short editorial tag — "Top Pick", "Runner-up", "Hidden Gem", "Workhorse", "Daily Driver", "Quiet Champion". 2-3 words. Title Case. One "Top Pick" for the headline item.',
    faqTopics: [
      'Why these specific picks',
      'How long they were tested',
      'Who this list is for',
      'What to buy first if budget is tight',
    ],
  },
  comparison: {
    roleLabel: null,
    faqTopics: [
      'Which is the better value',
      'Which is worth the upgrade',
      'Which to pick for a specific use case (beginner / heavy use / travel)',
      'Whether either is overhyped',
      'Are there alternatives that didn\'t make this comparison',
    ],
  },
  stack: {
    roleLabel: 'The piece\'s role in the kit — "The Anchor", "Daily Driver", "Recovery Backbone", "Quiet Workhorse", "Late-Night Saver". Tie to the FUNCTION inside the stack, not the product\'s generic strengths.',
    faqTopics: [
      'Can items in the stack be substituted',
      'A budget version of the stack',
      'How long until results show',
      'What to add if you want to upgrade',
      'Who shouldn\'t run the full stack',
    ],
  },
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { success, remaining } = await checkRateLimit(`collection-fill:${user.id}`, 'collection-fill')
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded. 15 generations per hour.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = Input.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { collectionType, title, description, itemReviewIds } = parsed.data

  const admin = createAdminClient()
  const { data: reviews } = await admin
    .from('reviews')
    .select('id, title, product_name, category, rating, excerpt, tldr, score_quality, score_value, score_ease, score_daily_use, best_for')
    .in('id', itemReviewIds)

  if (!reviews || reviews.length === 0) {
    return NextResponse.json({ error: 'No reviews found for the supplied IDs.' }, { status: 400 })
  }

  // Preserve editor's ordering — the position is meaningful (best_of headline first, etc.)
  const orderedReviews = itemReviewIds
    .map((id) => reviews.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))

  const guidance = FLAVOR_GUIDANCE[collectionType] ?? FLAVOR_GUIDANCE.general
  const wantsRoleLabels = guidance.roleLabel !== null

  const reviewLines = orderedReviews.map((r, idx) => {
    const subs = `Q${r.score_quality ?? '—'}/V${r.score_value ?? '—'}/E${r.score_ease ?? '—'}/D${r.score_daily_use ?? '—'}`
    const rawBestFor = (r as { best_for?: unknown }).best_for
    const bestForArr = Array.isArray(rawBestFor) ? rawBestFor.filter((x): x is string => typeof x === 'string') : []
    const bestFor = bestForArr.slice(0, 3).join('; ')
    return `${idx + 1}. id=${r.id} | ${r.product_name} (${r.category}) | ${r.rating ?? '—'}/10 ${subs} | tldr: ${r.tldr ?? r.excerpt ?? ''} | best for: ${bestFor}`
  }).join('\n')

  const faqGuide = guidance.faqTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')

  const prompt = `You're filling out the per-pick layer of a "${collectionType}" collection. Return your result by calling the submit_fill tool. Fields: blurbs (one 2-3 sentence editorial blurb per pick in Boss Daddy voice, each keyed by its review id)${wantsRoleLabels ? ', roleLabels (one short 2-4 word role tag per pick, keyed by its review id)' : ''}, and faqs (short question + concise 1-3 sentence answer pairs).

Collection title: ${title}
${description ? `Tagline: ${description}\n` : ''}Flavor: ${collectionType}

Picks (in editor order):
${reviewLines}

PER-PICK BLURB RULES:
- 2-3 sentences each, first-person dad voice, real-testing language.
- Frame WHY this pick belongs on THIS list — not just what the product is.
- Avoid restating the product name in the first sentence. Lead with use, scenario, or stake.
- 30-60 words per blurb. Tight.

${wantsRoleLabels ? `ROLE LABELS:
${guidance.roleLabel}
- Return ONE role label per pick, keyed by the review id.
- Title Case. No emoji.

` : ''}FAQ RULES:
- Generate 5 to 6 Q&As specifically tuned for a "${collectionType}" page. Cover:
${faqGuide}
- Answers stay concise and direct. No hedging. No corporate speak.
- Questions are plain-English, the kind a real reader would type into Google.

Return your result by calling the submit_fill tool.`

  const systemMessages = await buildBossDaddySystemMessages(supabase, user.id)
  let payload: Payload
  try {
    payload = await aiGenerateObject<Payload>({
      bucket: 'content',
      tag: 'collection-fill',
      schema: FILL_SCHEMA,
      system: systemMessages,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 2500,
      maxRetries: 4,
    })
  } catch (err: unknown) {
    const c = classifyClaudeError(err)
    console.error('collection-fill generation error:', c.kind, '-', c.detail)
    // Truncated output is incomplete — say so plainly.
    if (c.kind === 'truncated') {
      return NextResponse.json({ error: 'The fill ran long and got cut off. Please try again.' }, { status: 502 })
    }
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }

  const idSet = new Set(itemReviewIds)

  const blurbs = (payload.blurbs ?? [])
    .map((b) => ({ id: String(b.id ?? ''), blurb: String(b.blurb ?? '').trim() }))
    .filter((b) => idSet.has(b.id) && b.blurb.length > 0 && b.blurb.length <= 500)

  const roleLabels = wantsRoleLabels
    ? (payload.roleLabels ?? [])
        .map((r) => ({ id: String(r.id ?? ''), label: String(r.label ?? '').trim() }))
        .filter((r) => idSet.has(r.id) && r.label.length > 0 && r.label.length <= 80)
    : []

  const faqs = (payload.faqs ?? [])
    .map((f) => ({
      question: String(f.question ?? '').trim().slice(0, 200),
      answer:   String(f.answer ?? '').trim().slice(0, 1000),
    }))
    .filter((f) => f.question.length > 0 && f.answer.length > 0)
    .slice(0, 6)

  return NextResponse.json({ blurbs, roleLabels, faqs, remaining })
}
