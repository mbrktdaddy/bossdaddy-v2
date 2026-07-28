import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MODERATOR_SYSTEM } from '@/lib/claude/client'
import { isInquiryCategory } from '@/lib/categories'
import { aiGenerateObject } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { ModerationResultSchema, type ModerationResult } from '@/lib/claude/moderation'
import { z } from 'zod'

const ModerateInput = z.union([
  z.object({ reviewId: z.string().uuid() }),
  z.object({ guideId: z.string().uuid() }),
  z.object({ articleId: z.string().uuid() }), // legacy alias
])

// Internal endpoint — called server-side after review or article submission.
// Requires X-Internal-Secret header matching INTERNAL_API_SECRET env var.
export const maxDuration = 60

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
    ? await supabase.from('guides').select('id, title, content, category').eq('id', contentId).single()
    : await supabase.from('reviews').select('id, title, content, has_affiliate_links, disclosure_acknowledged').eq('id', contentId).single()

  if (error || !content) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  }

  const hasAffiliateLinks = 'has_affiliate_links' in content ? content.has_affiliate_links : false
  const disclosureAcknowledged = 'disclosure_acknowledged' in content ? content.disclosure_acknowledged : false

  // Discussion essays get judged as essays, not as product content — without
  // this the gear-shaped rubric reads unfalsifiable claims about God or meaning
  // as "misleading claims" and a missing verdict as thin content. Derived from
  // the pillar rather than passed in: inquiry mode isn't persisted on the row,
  // and moderation must not be steerable by the caller anyway. The consequence
  // is that an inquiry piece filed under a gear pillar is moderated as gear.
  // Reviews are never inquiry pieces. The literal "INQUIRY MODE: ON" line is the
  // trigger MODERATOR_SYSTEM keys off — don't reword it.
  const inquiry = isGuide && isInquiryCategory((content as { category?: string }).category ?? '')

  const prompt = `${inquiry ? `INQUIRY MODE: ON\n\n` : ''}Review the following content submission:

Title: ${content.title}${inquiry ? `\nPillar: ${(content as { category?: string }).category}` : ''}
Has affiliate links: ${hasAffiliateLinks ?? false}
Disclosure acknowledged: ${disclosureAcknowledged ?? false}

Content:
${content.content.slice(0, 4000)}

Return JSON: { "score": number (0-1), "flags": string[], "recommendation": "approve"|"review"|"reject" }`

  try {
    // `moderation` bucket is PINNED to Claude (compliance gate — see lib/flags.ts).
    // The SDK validates the output against ModerationResultSchema, replacing the
    // manual regex JSON extraction; an unparseable/invalid shape throws → catch.
    const result: ModerationResult = await aiGenerateObject<ModerationResult>({
      bucket: 'moderation',
      tag: 'moderate-review',
      schema: ModerationResultSchema,
      system: MODERATOR_SYSTEM,
      prompt,
      maxOutputTokens: 512,
      // A compliance gate must be reproducible: the same submission has to score
      // the same way twice, or the audit trail means nothing. Previously unset
      // (provider default ~1.0) — the one lane where sampling is indefensible.
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
