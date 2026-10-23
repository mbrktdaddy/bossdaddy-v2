import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MODERATOR_SYSTEM } from '@/lib/claude/client'
import { isInquiryCategory } from '@/lib/categories'
import { aiGenerateObject } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { ModerationResultSchema, type ModerationResult } from '@/lib/claude/moderation'
import { htmlToStructuredText } from '@/lib/content/html'
import { INQUIRY_TRIGGER } from '@/lib/content/prompts'
import { z } from 'zod'

const ModerateInput = z.union([
  z.object({ reviewId: z.string().uuid() }),
  z.object({ guideId: z.string().uuid() }),
  z.object({ articleId: z.string().uuid() }), // legacy alias
])

// Internal endpoint — called server-side after review or article submission.
// Requires X-Internal-Secret header matching INTERNAL_API_SECRET env var.
export const maxDuration = 60

// The moderator used to see `content.slice(0, 4000)` of raw HTML — roughly the
// first 40% of a review — and never the verdict, the blocks, or the author's
// testing notes, so it could not tell a real firsthand claim from an invented
// one. It now sees the whole piece as structured text, every block, and the
// notes, capped well above any real article.
const MAX_BODY_CHARS = 40_000

type Faq = { question?: string; answer?: string }

function list(label: string, items: unknown): string | null {
  if (!Array.isArray(items) || items.length === 0) return null
  return `${label}:\n${items.map((i) => `- ${String(i)}`).join('\n')}`
}

function faqList(items: unknown): string | null {
  if (!Array.isArray(items) || items.length === 0) return null
  return `FAQs:\n${(items as Faq[]).map((f) => `Q: ${f?.question ?? ''}\nA: ${f?.answer ?? ''}`).join('\n\n')}`
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-internal-secret')
  const expected = process.env.INTERNAL_API_SECRET
  // Fail closed: if the secret is unset, both sides are undefined and a plain
  // `secret !== expected` would PASS, opening the endpoint to anyone.
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = ModerateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const isGuide = 'guideId' in parsed.data || 'articleId' in parsed.data
  const contentId = isGuide
    ? (('guideId' in parsed.data ? (parsed.data as { guideId: string }).guideId : (parsed.data as { articleId: string }).articleId))
    : (parsed.data as { reviewId: string }).reviewId
  const table = isGuide ? 'guides' : 'reviews'

  const { data: content, error } = isGuide
    ? await supabase.from('guides')
        .select('id, title, content, category, has_affiliate_links, disclosure_acknowledged, tldr, key_takeaways, faqs')
        .eq('id', contentId).single()
    : await supabase.from('reviews')
        .select('id, title, content, product_name, has_affiliate_links, disclosure_acknowledged, tldr, key_takeaways, best_for, not_for, faqs, pros, cons, testing_duration, testing_note, how_you_used_it, standout_moment')
        .eq('id', contentId).single()

  if (error || !content) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  }

  const row = content as Record<string, unknown>
  const hasAffiliateLinks = row.has_affiliate_links === true
  const disclosureAcknowledged = row.disclosure_acknowledged === true

  // Discussion essays get judged as essays, not as product content — without
  // this the gear-shaped rubric reads unfalsifiable claims about God or meaning
  // as "misleading claims" and a missing verdict as thin content. Derived from
  // the pillar rather than passed in: moderation must not be steerable by the
  // caller. The consequence is that an inquiry piece filed under a gear pillar
  // is moderated as gear. Reviews are never inquiry pieces. INQUIRY_TRIGGER is
  // the literal MODERATOR_SYSTEM keys off.
  const inquiry = isGuide && isInquiryCategory((row.category as string | undefined) ?? '')

  // What the author actually did, in his own words — the baseline every
  // firsthand claim in the body is checked against (FTC 16 CFR 255).
  const notes = isGuide ? null : [
    row.testing_duration ? `Testing duration: ${row.testing_duration}` : null,
    row.testing_note ? `Testing note: ${row.testing_note}` : null,
    row.how_you_used_it ? `How I used it: ${row.how_you_used_it}` : null,
    row.standout_moment ? `Standout moment: ${row.standout_moment}` : null,
  ].filter(Boolean).join('\n')

  const blocks = [
    row.tldr ? `TL;DR: ${row.tldr}` : null,
    list('Key takeaways', row.key_takeaways),
    isGuide ? null : list('Best for', row.best_for),
    isGuide ? null : list('Not for', row.not_for),
    isGuide ? null : list('Pros', row.pros),
    isGuide ? null : list('Cons', row.cons),
    faqList(row.faqs),
  ].filter(Boolean).join('\n\n')

  const prompt = `${inquiry ? `${INQUIRY_TRIGGER}\n\n` : ''}Review the following content submission:

Title: ${row.title}${isGuide ? `\nPillar: ${row.category ?? ''}` : `\nProduct: ${row.product_name ?? ''}`}
Has affiliate links: ${hasAffiliateLinks}
Disclosure acknowledged: ${disclosureAcknowledged}
${notes ? `
AUTHOR'S TESTING NOTES (the only firsthand experience on record — a firsthand claim in the body that goes beyond these is the thing to flag):
${notes}
` : isGuide ? '' : `
AUTHOR'S TESTING NOTES: none on record — any firsthand usage claim in the body is unsupported and should be flagged for the author to confirm.
`}
Body ("## " marks a section heading):
${htmlToStructuredText(String(row.content ?? '')).slice(0, MAX_BODY_CHARS)}
${blocks ? `
Structured blocks shown beside the body:
${blocks}
` : ''}
Return JSON: { "score": number (0-1), "flags": string[], "recommendation": "approve"|"review"|"reject" }`

  try {
    // `moderation` bucket is PINNED to Claude (compliance gate — see lib/flags.ts).
    // The SDK validates the output against ModerationResultSchema; an
    // unparseable/invalid shape throws → catch.
    const result: ModerationResult = await aiGenerateObject<ModerationResult>({
      bucket: 'moderation',
      tag: 'moderate-review',
      schema: ModerationResultSchema,
      system: MODERATOR_SYSTEM,
      prompt,
      maxOutputTokens: 512,
      // A compliance gate must be reproducible: the same submission has to score
      // the same way twice, or the audit trail means nothing.
      temperature: 0,
      // Classification against a fixed rubric — deep reasoning buys nothing here,
      // and the gate sits in the submit path where latency is user-visible.
      effort: 'low',
    })

    await supabase
      .from(table)
      .update({
        moderation_score: result.score,
        moderation_flags: result.flags,
      })
      .eq('id', content.id)

    return NextResponse.json(result)
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('moderate error:', c.kind, '-', c.detail)
    return NextResponse.json({ error: 'Moderation failed' }, { status: 502 })
  }
}
