import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { checkRateLimit } from '@/lib/rate-limit'
import { generateUniqueSlug } from '@/lib/slug'
import { sanitizeHtml } from '@/lib/sanitize'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { computeReadingTime } from '@/lib/reading-time'
import { z } from 'zod'

export const maxDuration = 90

// Reviews must be at least this many days old before a follow-up can be scheduled.
// Prevents the editor from queuing a "6-month update" on day 2.
const MIN_PARENT_AGE_DAYS = 30

const ScheduleSchema = z.object({
  milestone_label: z.string().trim().min(2).max(80),
})

function staticScaffold(milestoneDays: number, previousRating: number | null): string {
  const ratingLine =
    previousRating != null
      ? `<p>Your initial verdict was ${previousRating.toFixed(1)}/10. ${milestoneDays} days in, does it still hold?</p>`
      : `<p>It has been ${milestoneDays} days. What is different now compared to first impressions?</p>`
  return [
    `<h2>What changed</h2>`,
    ratingLine,
    `<h2>What I got wrong</h2>`,
    `<p>Be honest with the brotherhood — what did the original review miss or get wrong?</p>`,
    `<h2>Would I buy it again</h2>`,
    `<p>Knowing what you know now, the honest yes-or-no.</p>`,
    `<h2>Photo update</h2>`,
    `<p>Drop a current shot showing real wear and tear (optional but encouraged).</p>`,
  ].join('\n')
}

// Generates a personalized scaffold for the 4 required follow-up sections. The
// scaffold is INTENTIONALLY short — these are starter prompts the author will
// replace, not finished prose. Returns the static fallback if Claude fails so
// the route never blocks a draft from being created.
async function generateScaffold(opts: {
  supabase: SupabaseClient
  parentAuthorId: string
  parentTitle: string
  parentProductName: string
  parentExcerpt: string | null
  parentContent: string
  previousRating: number | null
  milestoneLabel: string
  milestoneDays: number
}): Promise<string> {
  const fallback = staticScaffold(opts.milestoneDays, opts.previousRating)

  const contextSnippet = (
    opts.parentExcerpt?.trim() ||
    opts.parentContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400)
  ).trim()

  const ratingLine =
    opts.previousRating != null
      ? `Initial verdict: ${opts.previousRating.toFixed(1)}/10`
      : `Initial verdict rating: not recorded`

  const prompt = `You are scaffolding a follow-up review. The author originally published this ${opts.milestoneDays} days ago and is now writing a "${opts.milestoneLabel}". Produce SHORT prose starters under each of the 4 required headings — the author will edit and replace these.

ORIGINAL REVIEW CONTEXT:
- Title: ${opts.parentTitle}
- Product: ${opts.parentProductName}
- ${ratingLine}
- Excerpt/summary: ${contextSnippet}

REQUIRED OUTPUT — four HTML sections in this exact order, each headed by an <h2>:
1. <h2>What changed</h2> — 1–2 sentences asking what's different after ${opts.milestoneDays} days of real use. Reference the original verdict if useful.
2. <h2>What I got wrong</h2> — 1–2 sentences inviting honest reflection on what the original review missed.
3. <h2>Would I buy it again</h2> — 1–2 sentences framing the rebuy decision.
4. <h2>Photo update</h2> — 1 sentence prompting an in-use photo (note it is optional).

Tone: prompt the author, do not answer for them. Voice should match the brand but stay open-ended — "What is different now?" not "Six months in, the carrier holds up." Do not write conclusions or verdicts — that is the author's job.

Return JSON ONLY (no markdown, no code fences): { "content": "<h2>What changed</h2>\\n<p>...</p>\\n..." }`

  try {
    const systemBlocks = await buildBossDaddySystemBlocks(opts.supabase, opts.parentAuthorId)
    const result = await getClaudeClient().messages.create({
      model: MODEL,
      max_tokens: 600,
      system: systemBlocks,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = result.content.find((b) => b.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return fallback
    const parsed = JSON.parse(jsonMatch[0]) as { content?: unknown }
    const content = typeof parsed.content === 'string' ? parsed.content.trim() : ''
    return content || fallback
  } catch (err) {
    console.error('schedule-followup scaffold generation failed, using static fallback:', err)
    return fallback
  }
}

// POST /api/reviews/[id]/schedule-followup — create a draft follow-up review
// that points at [id] as its parent. The parent must be a top-level, approved,
// visible review at least MIN_PARENT_AGE_DAYS old. The requester must be an
// admin or the parent's author. The follow-up inherits author_id, product, and
// category from the parent; content is a Claude-generated scaffold; image_url
// is intentionally null (a fresh in-use photo is required).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { user } = await getUserSafe(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || !['author', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only authors and admins can schedule follow-ups.' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = ScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { milestone_label } = parsed.data

    const { success, remaining, reset } = await checkRateLimit(`draft:${user.id}`)
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. You can generate 10 drafts per hour.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          },
        }
      )
    }

    const admin = createAdminClient()
    const { data: parent, error: parentErr } = await admin
      .from('reviews')
      .select(
        'id, title, product_name, product_slug, category, excerpt, content, author_id, status, is_visible, published_at, rating, parent_review_id'
      )
      .eq('id', id)
      .single()

    if (parentErr || !parent) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // Author can only schedule follow-ups on their own reviews; admin can on any.
    if (profile.role !== 'admin' && parent.author_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only schedule follow-ups on your own reviews.' },
        { status: 403 }
      )
    }

    // One-level-deep enforcement at the app layer. The DB trigger
    // (check_review_parent_is_toplevel) is the backstop.
    if (parent.parent_review_id !== null) {
      return NextResponse.json(
        {
          error:
            'Follow-ups cannot have follow-ups — schedule from the original top-level review.',
        },
        { status: 400 }
      )
    }

    if (parent.status !== 'approved' || !parent.is_visible) {
      return NextResponse.json(
        { error: 'Only published, visible reviews can have follow-ups scheduled.' },
        { status: 400 }
      )
    }

    if (!parent.published_at) {
      return NextResponse.json(
        { error: 'Parent review has no publish date — cannot compute milestone.' },
        { status: 400 }
      )
    }

    const publishedAt = new Date(parent.published_at)
    const ageMs = Date.now() - publishedAt.getTime()
    const milestoneDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
    if (milestoneDays < MIN_PARENT_AGE_DAYS) {
      return NextResponse.json(
        {
          error: `Parent review must be at least ${MIN_PARENT_AGE_DAYS} days old. Currently ${milestoneDays} days.`,
        },
        { status: 400 }
      )
    }

    const previousRating = parent.rating != null ? Number(parent.rating) : null

    const baseTitle = `${parent.product_name} — ${milestone_label}`.slice(0, 120)
    const slug = await generateUniqueSlug(admin, 'reviews', baseTitle)

    const scaffold = await generateScaffold({
      supabase,
      parentAuthorId: parent.author_id,
      parentTitle: parent.title,
      parentProductName: parent.product_name,
      parentExcerpt: parent.excerpt,
      parentContent: parent.content,
      previousRating,
      milestoneLabel: milestone_label,
      milestoneDays,
    })

    const sanitizedContent = sanitizeHtml(scaffold)
    const hasAffiliateLinks = detectAffiliateLinks(sanitizedContent)

    const { data: created, error: insertErr } = await admin
      .from('reviews')
      .insert({
        author_id: parent.author_id,
        slug,
        title: baseTitle,
        product_name: parent.product_name,
        product_slug: parent.product_slug,
        category: parent.category,
        excerpt: null,
        content: sanitizedContent,
        image_url: null,
        pros: [],
        cons: [],
        has_affiliate_links: hasAffiliateLinks,
        disclosure_acknowledged: false,
        reading_time_minutes: computeReadingTime(sanitizedContent),
        status: 'draft',
        parent_review_id: parent.id,
        milestone_label,
        milestone_days: milestoneDays,
        previous_rating: previousRating,
        // verdict_change is set on the follow-up form, not at scheduling time
      })
      .select('id, slug')
      .single()

    if (insertErr) {
      console.error('schedule-followup insert failed:', insertErr)
      if (insertErr.code === '23505') {
        return NextResponse.json(
          { error: 'A follow-up with this title already exists. Try a different milestone label.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: `Failed to schedule follow-up: ${insertErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ review: created }, { status: 201 })
  } catch (err) {
    console.error('Uncaught in POST /api/reviews/[id]/schedule-followup:', err)
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 })
  }
}
