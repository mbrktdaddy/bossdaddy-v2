// Content freshness — the rules behind the weekly sweep (app/api/cron/freshness-sweep)
// and the dashboard's "needs a look" card. Pure: the cron loads rows, this
// decides, the cron reconciles `content_freshness_flags` (mig 167).
//
// Three reasons, in priority order per item (an item carries at most one of
// the first and third — "due" supersedes "stale"):
//   followup-due        — the author set a date, it has passed, nothing verified since
//   product-unavailable — the reviewed product is archived in the catalog
//   stale               — NO intent set and the heuristic window has passed
//                         (reviews: 150 days since publish / last follow-up /
//                         last verify; guides: 365 days since publish / edit /
//                         last verify). An intent in the future means the author
//                         has a plan — never stale.

export type FreshnessReason = 'followup-due' | 'product-unavailable' | 'stale'
export type FreshnessContentType = 'review' | 'guide'

/** "5 months" in spec language — the heuristic a review falls back to with no intent set. */
export const REVIEW_STALE_DAYS = 150
/** Guides refresh in place; a year untouched is the plan's threshold. */
export const GUIDE_STALE_DAYS = 365

/** The catalog status that means "you can't buy this any more". */
export const UNAVAILABLE_PRODUCT_STATUSES: readonly string[] = ['archived']

const ONE_DAY_MS = 86_400_000

export interface ReviewFreshnessInput {
  id: string
  published_at: string | null
  followup_intent_at: string | null
  last_verified_at: string | null
  product_slug: string | null
  /** Newest follow-up review's publish (or create) time, if any. */
  latest_followup_at: string | null
}

export interface GuideFreshnessInput {
  id: string
  published_at: string | null
  updated_at: string | null
  followup_intent_at: string | null
  last_verified_at: string | null
}

export interface ProductFreshnessInput {
  slug: string
  name: string
  status: string
}

export interface FreshnessFlag {
  contentType: FreshnessContentType
  contentId: string
  reason: FreshnessReason
  detail: string
}

export const FRESHNESS_REASON_LABEL: Record<FreshnessReason, string> = {
  'followup-due': 'Follow-up due',
  'product-unavailable': 'Product unavailable',
  'stale': 'Stale',
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

function daysBetween(fromMs: number, toMs: number): number {
  return Math.floor((toMs - fromMs) / ONE_DAY_MS)
}

function shortDate(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

/**
 * The intent rule shared by both types. Returns the detail line when the
 * intent has passed and nothing was verified at or after it; null otherwise.
 */
function followupDue(intentIso: string | null, verifiedIso: string | null, nowMs: number): string | null {
  const intent = ms(intentIso)
  if (intent == null || intent > nowMs) return null
  const verified = ms(verifiedIso)
  if (verified != null && verified >= intent) return null
  const overdue = daysBetween(intent, nowMs)
  return overdue === 0
    ? `Follow-up intended for ${shortDate(intent)} (today)`
    : `Follow-up intended for ${shortDate(intent)} · ${overdue} day${overdue === 1 ? '' : 's'} overdue`
}

/** An intent that is set and still in the future = the author has a plan. */
function hasFuturePlan(intentIso: string | null, nowMs: number): boolean {
  const intent = ms(intentIso)
  return intent != null && intent > nowMs
}

export function computeFreshnessFlags(input: {
  reviews: ReviewFreshnessInput[]
  guides: GuideFreshnessInput[]
  products: ProductFreshnessInput[]
  now?: Date
}): FreshnessFlag[] {
  const nowMs = (input.now ?? new Date()).getTime()
  const productBySlug = new Map(input.products.map((p) => [p.slug, p]))
  const out: FreshnessFlag[] = []

  for (const r of input.reviews) {
    const due = followupDue(r.followup_intent_at, r.last_verified_at, nowMs)
    if (due) out.push({ contentType: 'review', contentId: r.id, reason: 'followup-due', detail: due })

    const product = r.product_slug ? productBySlug.get(r.product_slug) : undefined
    if (product && UNAVAILABLE_PRODUCT_STATUSES.includes(product.status)) {
      out.push({ contentType: 'review', contentId: r.id, reason: 'product-unavailable', detail: `${product.name} is ${product.status} in the catalog` })
    }

    // The heuristic only speaks when the author hasn't: no intent at all.
    if (!r.followup_intent_at && !due) {
      const published = ms(r.published_at)
      if (published != null) {
        const reference = Math.max(published, ms(r.latest_followup_at) ?? 0, ms(r.last_verified_at) ?? 0)
        const days = daysBetween(reference, nowMs)
        if (days >= REVIEW_STALE_DAYS) {
          out.push({ contentType: 'review', contentId: r.id, reason: 'stale', detail: `No follow-up or verification in ${days} days` })
        }
      }
    }
  }

  for (const g of input.guides) {
    const due = followupDue(g.followup_intent_at, g.last_verified_at, nowMs)
    if (due) out.push({ contentType: 'guide', contentId: g.id, reason: 'followup-due', detail: due })

    if (!g.followup_intent_at && !due && !hasFuturePlan(g.followup_intent_at, nowMs)) {
      const published = ms(g.published_at)
      if (published != null) {
        const reference = Math.max(published, ms(g.updated_at) ?? 0, ms(g.last_verified_at) ?? 0)
        const days = daysBetween(reference, nowMs)
        if (days >= GUIDE_STALE_DAYS) {
          out.push({ contentType: 'guide', contentId: g.id, reason: 'stale', detail: `Untouched for ${days} days` })
        }
      }
    }
  }

  return out
}

/** Preset offsets for the workspace's intent control, in days. */
export const FOLLOWUP_INTENT_PRESETS = [
  { value: '30d', label: '30 days', days: 30 },
  { value: '60d', label: '60 days', days: 60 },
  { value: '6mo', label: '6 months', days: 182 },
  { value: '1yr', label: '1 year', days: 365 },
] as const

export type FollowupIntentPreset = (typeof FOLLOWUP_INTENT_PRESETS)[number]['value']

/** ISO timestamp `days` after `from` (midday UTC so a date-only display never slips a day). */
export function intentFromPreset(preset: FollowupIntentPreset, from: Date = new Date()): string {
  const days = FOLLOWUP_INTENT_PRESETS.find((p) => p.value === preset)!.days
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + days, 12, 0, 0))
  return d.toISOString()
}
