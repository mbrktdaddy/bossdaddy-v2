import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeHtml } from '@/lib/sanitize'
import { getClaudeClient, MODEL, COMMENT_MODERATOR_SYSTEM } from '@/lib/claude/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const CreateCommentSchema = z.object({
  content_type: z.enum(['review', 'guide', 'product']),
  content_id:   z.string().uuid(),
  body:         z.string().min(5).max(2000),
})

// ── Lightweight scan for trusted users ──────────────────────────────────────
// Checks for the most obvious malicious signals without calling Claude.
// Returns suspicious=true if any flag fires, sending the comment to manual review.

const SPAM_KEYWORDS = [
  'click here', 'free money', 'make money fast', 'work from home',
  'crypto investment', 'bitcoin profit', 'earn $', 'guaranteed income',
  'limited time offer', 'act now', 'buy followers', 'buy likes',
  'cheap seo', 'whatsapp me', 'telegram me', 'dm me for',
]

function lightweightScan(body: string): { suspicious: boolean; flags: string[] } {
  const flags: string[] = []
  const lower = body.toLowerCase()

  // Multiple URLs
  if ((body.match(/https?:\/\//g) ?? []).length > 1) flags.push('multiple_urls')

  // Known spam phrases
  if (SPAM_KEYWORDS.some(kw => lower.includes(kw))) flags.push('spam_keywords')

  // Phone number (contact harvesting)
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(body)) flags.push('phone_number')

  // Email address in comment body
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(body)) flags.push('email_in_body')

  // Excessive caps (> 60% of letters are uppercase, body > 20 chars)
  const letters = body.replace(/[^a-zA-Z]/g, '')
  if (letters.length > 20) {
    const upperRatio = (body.match(/[A-Z]/g) ?? []).length / letters.length
    if (upperRatio > 0.6) flags.push('excessive_caps')
  }

  // Repetitive words (same non-common word 5+ times)
  const stopWords = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'have', 'from'])
  const wordFreq: Record<string, number> = {}
  for (const w of lower.split(/\s+/)) {
    if (w.length > 3 && !stopWords.has(w)) {
      wordFreq[w] = (wordFreq[w] ?? 0) + 1
      if (wordFreq[w] >= 5) { flags.push('repetitive_content'); break }
    }
  }

  return { suspicious: flags.length > 0, flags }
}

// ── Claude moderation for non-trusted users ─────────────────────────────────

interface ModerationResult {
  score: number
  flags: string[]
  recommendation: 'approve' | 'review' | 'reject'
}

async function moderateWithClaude(body: string): Promise<ModerationResult> {
  const client = getClaudeClient()
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: [{ type: 'text', text: COMMENT_MODERATOR_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: body }],
  })

  const raw = (response.content[0] as { type: 'text'; text: string }).text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  return JSON.parse(raw) as ModerationResult
}

// ── Trust promotion ─────────────────────────────────────────────────────────
// After each approved insert, check if the user has reached the 5-comment threshold.

async function checkTrustPromotion(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { count } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', userId)
    .eq('status', 'approved')
    .is('moderation_flags', null)

  if ((count ?? 0) >= 5) {
    await supabase
      .from('profiles')
      .update({ trusted_commenter: true })
      .eq('id', userId)
  }
}

// ── POST /api/comments ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
  const { success } = await checkRateLimit(`comment:${ip}`, 'submit')
  if (!success) return NextResponse.json({ error: 'Too many comments. Try again later.' }, { status: 429 })

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Sign in to leave a comment.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = CreateCommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const sanitized = sanitizeHtml(parsed.data.body.trim())

  // Fetch trust status
  const { data: profile } = await supabase
    .from('profiles')
    .select('trusted_commenter')
    .eq('id', user.id)
    .single()

  const isTrusted = profile?.trusted_commenter === true

  // ── Publish-first policy ────────────────────────────────────────────────
  // Commenting should feel free and immediate. Everything publishes on submit
  // EXCEPT content the spam net flags as clearly malicious, which is silently
  // rejected. Borderline comments still post, but keep their flags/score so an
  // admin can spot-check and remove them after the fact (post-moderation).
  const HARD_REJECT_SCORE = 0.85

  let status: 'pending' | 'approved' | 'rejected' = 'approved'
  let moderationScore: number | null = null

  // Cheap regex scan runs for everyone — it's the baseline net and the
  // fallback when Claude is unavailable.
  const scan = lightweightScan(sanitized)
  let moderationFlags: string[] = scan.flags

  if (isTrusted) {
    // Trusted commenters publish immediately; flags are kept for visibility only.
    status = 'approved'
  } else {
    try {
      const result = await moderateWithClaude(sanitized)
      moderationScore = result.score
      moderationFlags = Array.from(new Set([...moderationFlags, ...(result.flags ?? [])]))

      if (result.score >= HARD_REJECT_SCORE || result.recommendation === 'reject') {
        // Clear spam/malicious only — silent reject (spammer sees a generic
        // "pending" message and never knows it was blocked).
        return NextResponse.json({ comment: { status: 'pending' } }, { status: 201 })
      }

      // Everything else publishes immediately.
      status = 'approved'
    } catch {
      // Claude unavailable — fall back to the lightweight scan. Only strong
      // spam signals hold for review; otherwise still publish.
      if (scan.suspicious) {
        moderationFlags = Array.from(new Set([...moderationFlags, 'moderation_unavailable']))
        status = 'pending'
      } else {
        status = 'approved'
      }
    }
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      author_id:        user.id,
      content_type:     parsed.data.content_type,
      content_id:       parsed.data.content_id,
      body:             sanitized,
      status,
      moderation_score: moderationScore,
      moderation_flags: moderationFlags,
    })
    .select('id, status')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })

  // Check trust promotion after any approved insert
  if (status === 'approved' && !isTrusted) {
    checkTrustPromotion(supabase, user.id).catch(() => {})
  }

  // Flush the public page cache so router.refresh() returns the new comment
  if (status === 'approved') {
    const ct = parsed.data.content_type
    const tableMap   = { review: 'reviews', guide: 'guides', product: 'products' } as const
    const prefixMap  = { review: '/reviews', guide: '/guides', product: '/bench' } as const
    const admin = createAdminClient()
    const { data: content } = await admin.from(tableMap[ct]).select('slug').eq('id', parsed.data.content_id).single()
    if (content?.slug) revalidatePath(`${prefixMap[ct]}/${content.slug}`)
  }

  return NextResponse.json({ comment: data }, { status: 201 })
}
