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
    .select('id, title, product_name, category, excerpt, content, image_url, rating, pros, cons, has_affiliate_links, disclosure_acknowledged, status, slug, moderation_score, moderation_flags, created_at, updated_at, reading_time_minutes, rejection_reason, meta_title, meta_description, scheduled_publish_at, product_slug, tldr, key_takeaways, best_for, not_for, faqs')
    .eq('id', id)
    .single()

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
        <Link href="/dashboard/reviews" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors mb-6">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All reviews
        </Link>
        <p className="text-red-400">Review not found. It may have been deleted.</p>
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
    />
  )
}
