import type { SupabaseClient } from '@supabase/supabase-js'

// "5 months" in spec language — 150 days is the practical threshold for the
// dashboard "Follow-ups due" card. Both the parent's age and the gap since
// the last follow-up must exceed this for a review to surface.
export const FOLLOWUP_DUE_DAYS = 150
const ONE_DAY_MS = 1000 * 60 * 60 * 24

export type VerdictChange = 'improved' | 'unchanged' | 'declined' | 'complete_reversal'

// ── AI Specs Grade ───────────────────────────────────────────────────────────
// Shape of reviews.specs_grade_data — the reusable comparison artifact behind
// the Specs sub-score. Produced by /api/claude/specs-grade, author-reviewed,
// rendered in the public "how the specs stack up" disclosure.
export interface SpecsCompareEntry {
  name: string
  brand: string | null
  keySpecs: { label: string; value: string }[]
  sourceUrl: string | null
}
export interface SpecsGradeSource { title: string; url: string }
export interface SpecsGradeData {
  comparedAgainst: SpecsCompareEntry[]
  sources: SpecsGradeSource[]
  gradedAt?: string
}

/** Coerce an unknown (jsonb) value into a safe SpecsGradeData. */
export function parseSpecsGradeData(raw: unknown): SpecsGradeData {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const comparedAgainst = Array.isArray(obj.comparedAgainst)
    ? (obj.comparedAgainst as unknown[])
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c) => ({
          name:  typeof c.name === 'string' ? c.name : '',
          brand: typeof c.brand === 'string' && c.brand.trim() ? c.brand : null,
          keySpecs: Array.isArray(c.keySpecs)
            ? (c.keySpecs as unknown[])
                .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object'
                  && typeof (s as Record<string, unknown>).label === 'string'
                  && typeof (s as Record<string, unknown>).value === 'string')
                .map((s) => ({ label: s.label as string, value: s.value as string }))
            : [],
          sourceUrl: typeof c.sourceUrl === 'string' && c.sourceUrl.trim() ? c.sourceUrl : null,
        }))
        .filter((c) => c.name)
    : []
  const sources = Array.isArray(obj.sources)
    ? (obj.sources as unknown[])
        .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && typeof (s as Record<string, unknown>).url === 'string')
        .map((s) => ({ title: typeof s.title === 'string' && s.title.trim() ? s.title : (s.url as string), url: s.url as string }))
    : []
  return { comparedAgainst, sources, gradedAt: typeof obj.gradedAt === 'string' ? obj.gradedAt : undefined }
}

// The 4 headings every follow-up review is expected to contain (the 4th is
// optional but encouraged). Kept in lowercase for matching; we display the
// stored capitalization from the article on the page.
export const REQUIRED_FOLLOWUP_HEADINGS = [
  'what changed',
  'what i got wrong',
  'would i buy it again',
  'photo update',
] as const

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function slugifyHeading(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section'
}

function isRequiredHeading(text: string): boolean {
  const trimmed = text.trim().toLowerCase()
  return REQUIRED_FOLLOWUP_HEADINGS.some((h) => h === trimmed)
}

export interface FollowupTocEntry {
  label: string
  anchor: string
}

/**
 * Transforms a follow-up review's HTML body so that the 4 required `<h2>`
 * sections render as collapsible `<details open>` blocks (so search engines
 * and skim-readers can still find the structure). Non-required headings pass
 * through unchanged with an anchor id added. Returns the transformed HTML
 * plus a TOC list of the matched required headings, in document order.
 *
 * Pure string transform — runs at render time on the server, never mutates
 * what's saved in the DB. Authors editing the draft see the plain `<h2>`
 * structure in TipTap.
 */
export function transformFollowupContent(html: string): { html: string; toc: FollowupTocEntry[] } {
  // Split on h2 boundaries — capture group keeps the heading text in the array.
  // After split, parts looks like: [intro, h2_text, body, h2_text, body, ...]
  const parts = html.split(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)
  if (parts.length <= 1) return { html, toc: [] }

  const intro = parts[0] ?? ''
  let out = intro
  const toc: FollowupTocEntry[] = []

  for (let i = 1; i < parts.length; i += 2) {
    const headingHtml = parts[i] ?? ''
    const heading = headingHtml.replace(/<[^>]+>/g, '').trim()
    const body = parts[i + 1] ?? ''
    if (!heading) {
      // Defensive: empty h2 — just pass through with the body
      out += `<h2></h2>${body}`
      continue
    }
    const anchor = slugifyHeading(heading)
    const escapedAnchor = escapeHtmlAttr(anchor)
    const escapedHeading = escapeHtmlAttr(heading)

    if (isRequiredHeading(heading)) {
      toc.push({ label: heading, anchor })
      // Inline `style="margin:0"` on the h2 — beats `prose-h2:mt-10 mb-4` from
      // the surrounding container via specificity, and survives Tailwind v4
      // class-detection edge cases for arbitrary classes injected via raw HTML.
      out += `<details open id="${escapedAnchor}" class="bd-followup-section group" style="margin-top:2.5rem;margin-bottom:1rem">`
        + `<summary class="cursor-pointer list-none flex items-baseline justify-between gap-3 hover:text-accent transition-colors" style="margin:0">`
        + `<h2 style="margin:0">${escapedHeading}</h2>`
        + `<svg class="w-4 h-4 text-accent-text group-open:rotate-180 transition-transform shrink-0 self-center" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>`
        + `</summary>`
        + body
        + `</details>`
    } else {
      out += `<h2 id="${escapedAnchor}">${escapedHeading}</h2>${body}`
    }
  }

  return { html: out, toc }
}

export interface ReviewTimelineNode {
  id: string
  slug: string | null
  title: string
  rating: number | null
  published_at: string | null
  parent_review_id: string | null
  milestone_label: string | null
  milestone_days: number | null
  previous_rating: number | null
  verdict_change: VerdictChange | null
  is_parent: boolean
}

/**
 * Returns the parent review plus every approved+visible follow-up belonging to
 * the same root, sorted chronologically (parent first, then follow-ups by
 * `milestone_days` ascending).
 *
 * Caller passes the current review's id AND its parent_review_id — saves a
 * round-trip vs. having this helper figure out the root itself. The trigger
 * enforces one-level-deep, so `parent_review_id IS NULL` identifies the root.
 */
export async function getReviewTimeline(
  client: SupabaseClient,
  reviewId: string,
  parentReviewId: string | null,
): Promise<ReviewTimelineNode[]> {
  const rootId = parentReviewId ?? reviewId

  // One round-trip: parent + all its follow-ups. PostgREST `or` accepts a
  // comma-separated list of clauses.
  const { data: rows, error } = await client
    .from('reviews')
    .select('id, slug, title, rating, published_at, parent_review_id, milestone_label, milestone_days, previous_rating, verdict_change')
    .or(`id.eq.${rootId},parent_review_id.eq.${rootId}`)
    .eq('status', 'approved')
    .eq('is_visible', true)

  if (error) {
    console.error('getReviewTimeline failed', error)
    return []
  }
  if (!rows || rows.length === 0) return []

  return rows
    .map((r): ReviewTimelineNode => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      rating: r.rating,
      published_at: r.published_at,
      parent_review_id: r.parent_review_id,
      milestone_label: r.milestone_label,
      milestone_days: r.milestone_days,
      previous_rating: r.previous_rating,
      verdict_change: r.verdict_change as VerdictChange | null,
      is_parent: r.parent_review_id === null,
    }))
    .sort((a, b) => {
      if (a.is_parent) return -1
      if (b.is_parent) return 1
      return (a.milestone_days ?? 0) - (b.milestone_days ?? 0)
    })
}

export interface FollowupDueRow {
  id: string
  title: string
  product_name: string
  slug: string | null
  category: string | null
  published_at: string
  daysSincePublished: number
  daysSinceLastUpdate: number   // === daysSincePublished when no follow-ups yet
  followupCount: number
  latestFollowupAt: string | null
}

/**
 * Top-level approved + visible reviews that are due for a follow-up.
 *
 * Criteria:
 *   - `parent_review_id IS NULL` (top-level only)
 *   - `status = 'approved'` AND `is_visible = true`
 *   - Parent's `published_at` is at least FOLLOWUP_DUE_DAYS old
 *   - Either no follow-up exists OR the latest follow-up is also at least
 *     FOLLOWUP_DUE_DAYS old
 *
 * No cron — this is the only reminder mechanism. The editor sees the list,
 * decides what's worth a follow-up, and schedules from the review workspace.
 */
export async function getFollowupsDue(
  client: SupabaseClient,
  limit = 10,
): Promise<FollowupDueRow[]> {
  const now = Date.now()
  const dueThresholdIso = new Date(now - FOLLOWUP_DUE_DAYS * ONE_DAY_MS).toISOString()

  // Top-level reviews aged past the threshold. Overfetch — some will be filtered
  // out by the latest-follow-up gap check below.
  const { data: parents, error: parentErr } = await client
    .from('reviews')
    .select('id, title, product_name, slug, category, published_at')
    .is('parent_review_id', null)
    .eq('status', 'approved')
    .eq('is_visible', true)
    .lte('published_at', dueThresholdIso)
    .order('published_at', { ascending: true })
    .limit(limit * 3)

  if (parentErr) {
    console.error('getFollowupsDue: parent fetch failed', parentErr)
    return []
  }
  if (!parents || parents.length === 0) return []

  const ids = parents.map((p) => p.id)

  // Pull ALL follow-ups for these parents in a single round-trip. Aggregate in JS
  // — the set is small enough that this beats a separate per-parent query.
  const { data: followups, error: followupErr } = await client
    .from('reviews')
    .select('parent_review_id, published_at, created_at')
    .in('parent_review_id', ids)

  if (followupErr) {
    console.error('getFollowupsDue: follow-up fetch failed', followupErr)
    return []
  }

  const latestByParent = new Map<string, string>()
  const countByParent = new Map<string, number>()
  for (const f of followups ?? []) {
    if (!f.parent_review_id) continue
    countByParent.set(f.parent_review_id, (countByParent.get(f.parent_review_id) ?? 0) + 1)
    const at = f.published_at ?? f.created_at
    if (!at) continue
    const current = latestByParent.get(f.parent_review_id)
    if (!current || at > current) latestByParent.set(f.parent_review_id, at)
  }

  const due: FollowupDueRow[] = []
  for (const p of parents) {
    if (!p.published_at) continue
    const publishedMs = new Date(p.published_at).getTime()
    const latestStr = latestByParent.get(p.id) ?? null
    const referenceMs = latestStr ? new Date(latestStr).getTime() : publishedMs
    const daysSinceLastUpdate = Math.floor((now - referenceMs) / ONE_DAY_MS)

    if (daysSinceLastUpdate >= FOLLOWUP_DUE_DAYS) {
      due.push({
        id: p.id,
        title: p.title,
        product_name: p.product_name,
        slug: p.slug,
        category: p.category,
        published_at: p.published_at,
        daysSincePublished: Math.floor((now - publishedMs) / ONE_DAY_MS),
        daysSinceLastUpdate,
        followupCount: countByParent.get(p.id) ?? 0,
        latestFollowupAt: latestStr,
      })
      if (due.length >= limit) break
    }
  }

  return due
}
