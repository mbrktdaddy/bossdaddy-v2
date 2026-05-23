import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReviewWorkspace } from './_components/ReviewWorkspace'

export default async function ReviewWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: review } = await admin
    .from('reviews')
    .select('id, title, product_name, category, excerpt, content, image_url, rating, pros, cons, has_affiliate_links, disclosure_acknowledged, status, slug, moderation_score, moderation_flags, created_at, updated_at, reading_time_minutes, rejection_reason, meta_title, meta_description, scheduled_publish_at, product_slug, tldr, key_takeaways, best_for, not_for, faqs, testing_duration, how_you_used_it, standout_moment, price_paid_cents, score_quality, score_value, score_ease, score_daily_use, would_rebuy, is_visible, published_at, parent_review_id, milestone_label, milestone_days, previous_rating, verdict_change')
    .eq('id', id)
    .single()

  // If this review IS a follow-up, fetch the parent for editor context.
  let parent: { id: string; title: string; slug: string | null; rating: number | null; published_at: string | null } | null = null
  if (review?.parent_review_id) {
    const { data: parentRow } = await admin
      .from('reviews')
      .select('id, title, slug, rating, published_at')
      .eq('id', review.parent_review_id)
      .single()
    parent = parentRow ?? null
  }

  // Count existing follow-ups when this IS a top-level review — surfaces "2 follow-ups already scheduled" in the workspace.
  let followupCount = 0
  if (review && review.parent_review_id === null) {
    const { count } = await admin
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('parent_review_id', review.id)
    followupCount = count ?? 0
  }

  // Compute parent age on the server. This is an async Server Component that
  // re-runs per request, so intentional per-request variance from Date.now()
  // is fine. The API route re-validates the 30-day gate on submit.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const parentAgeDays = review?.published_at
    ? Math.floor((now - new Date(review.published_at).getTime()) / (1000 * 60 * 60 * 24))
    : null

  // Fetch tags for this review
  const { data: tagRows } = await admin
    .from('review_tags').select('tag_slug').eq('review_id', id)
  const reviewTags = (tagRows ?? []).map((r) => r.tag_slug)

  // Look up product_id from slug so the workspace can pre-filter the media picker
  let productId: string | null = null
  if (review?.product_slug) {
    const { data: product } = await admin
      .from('products')
      .select('id')
      .eq('slug', review.product_slug)
      .single()
    productId = product?.id ?? null
  }

  if (!review) {
    return (
      <div className="p-8 max-w-3xl">
        <Link href="/dashboard/reviews" className="inline-flex items-center gap-2 text-xs text-prose-faint hover:text-prose transition-colors mb-6">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All reviews
        </Link>
        <p className="text-red-600">Review not found. It may have been deleted.</p>
      </div>
    )
  }

  return (
    <ReviewWorkspace
      review={{
        ...review,
        moderation_flags: (review.moderation_flags ?? []) as string[],
        pros: (review.pros ?? []) as string[],
        cons: (review.cons ?? []) as string[],
        key_takeaways: (review.key_takeaways ?? []) as string[],
        best_for: (review.best_for ?? []) as string[],
        not_for: (review.not_for ?? []) as string[],
        faqs: (review.faqs ?? []) as { question: string; answer: string }[],
        tags: reviewTags,
        product_id: productId,
      }}
      parent={parent}
      followupCount={followupCount}
      parentAgeDays={parentAgeDays}
    />
  )
}
