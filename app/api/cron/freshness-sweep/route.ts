import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeFreshnessFlags, type FreshnessFlag } from '@/lib/content/freshness'

export const maxDuration = 60

// Weekly (vercel.json). Decides which published pieces need a look — a passed
// follow-up intent, an archived product, or the stale heuristic — and
// reconciles `content_freshness_flags` (mig 167) to exactly that set: upsert
// what holds (first sighting kept), delete what no longer does. The dashboard
// card reads the table; nothing here touches reviews/guides (a sweep must never
// stamp `updated_at`, mig 131). Dashboard only, no email — decided 2026-07-20.
//
// Secured by the Vercel Cron secret. Hit manually with ?secret=... to test.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not set — cron endpoint refusing to run')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 503 })
  }
  const authHeader = request.headers.get('authorization')
  const qSecret = new URL(request.url).searchParams.get('secret')
  if (authHeader !== `Bearer ${secret}` && qSecret !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const sweepStartedAt = new Date()

  try {
    const [reviewsRes, guidesRes] = await Promise.all([
      admin
        .from('reviews')
        .select('id, published_at, followup_intent_at, last_verified_at, product_slug, parent_review_id')
        .eq('status', 'approved')
        .eq('is_visible', true),
      admin
        .from('guides')
        .select('id, published_at, updated_at, followup_intent_at, last_verified_at')
        .eq('status', 'approved')
        .eq('is_visible', true),
    ])
    if (reviewsRes.error) throw new Error(`reviews: ${reviewsRes.error.message}`)
    if (guidesRes.error) throw new Error(`guides: ${guidesRes.error.message}`)

    const allReviews = reviewsRes.data ?? []
    // Follow-ups are reviews too; only top-level ones get flagged, and the
    // newest follow-up is what keeps a parent fresh.
    const parents = allReviews.filter((r) => r.parent_review_id == null)
    const parentIds = new Set(parents.map((r) => r.id))

    const [followupsRes, productsRes] = await Promise.all([
      parentIds.size
        ? admin.from('reviews').select('parent_review_id, published_at, created_at').in('parent_review_id', [...parentIds])
        : Promise.resolve({ data: [], error: null }),
      admin.from('products').select('slug, name, status').in('slug', [...new Set(parents.map((r) => r.product_slug).filter((s): s is string => !!s))]),
    ])
    if (followupsRes.error) throw new Error(`follow-ups: ${followupsRes.error.message}`)
    if (productsRes.error) throw new Error(`products: ${productsRes.error.message}`)

    const latestFollowup = new Map<string, string>()
    for (const f of followupsRes.data ?? []) {
      if (!f.parent_review_id) continue
      const at = f.published_at ?? f.created_at
      if (!at) continue
      const cur = latestFollowup.get(f.parent_review_id)
      if (!cur || at > cur) latestFollowup.set(f.parent_review_id, at)
    }

    const flags = computeFreshnessFlags({
      now: sweepStartedAt,
      reviews: parents.map((r) => ({
        id: r.id,
        published_at: r.published_at,
        followup_intent_at: r.followup_intent_at,
        last_verified_at: r.last_verified_at,
        product_slug: r.product_slug,
        latest_followup_at: latestFollowup.get(r.id) ?? null,
      })),
      guides: (guidesRes.data ?? []).map((g) => ({
        id: g.id,
        published_at: g.published_at,
        updated_at: g.updated_at,
        followup_intent_at: g.followup_intent_at,
        last_verified_at: g.last_verified_at,
      })),
      products: (productsRes.data ?? []).map((p) => ({ slug: p.slug, name: p.name, status: p.status })),
    })

    // Reconcile. The upsert must land before the delete: if it throws, the
    // table keeps last week's set rather than being wiped.
    const seenAt = sweepStartedAt.toISOString()
    if (flags.length) {
      const { error } = await admin
        .from('content_freshness_flags')
        .upsert(
          flags.map((f: FreshnessFlag) => ({
            content_type: f.contentType,
            content_id: f.contentId,
            reason: f.reason,
            detail: f.detail,
            last_seen_at: seenAt,
          })),
          { onConflict: 'content_type,content_id,reason' },
        )
      if (error) throw new Error(`upsert: ${error.message}`)
    }
    const { error: delErr, count: cleared } = await admin
      .from('content_freshness_flags')
      .delete({ count: 'exact' })
      .lt('last_seen_at', seenAt)
    if (delErr) throw new Error(`delete: ${delErr.message}`)

    const byReason = flags.reduce<Record<string, number>>((acc, f) => { acc[f.reason] = (acc[f.reason] ?? 0) + 1; return acc }, {})
    return NextResponse.json({
      success: true,
      scanned: { reviews: parents.length, guides: (guidesRes.data ?? []).length },
      flagged: flags.length,
      byReason,
      cleared: cleared ?? 0,
      sweptAt: seenAt,
    })
  } catch (err) {
    console.error('freshness-sweep failed:', err)
    Sentry.captureException(err, { tags: { cron: 'freshness-sweep' } })
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 })
  }
}
