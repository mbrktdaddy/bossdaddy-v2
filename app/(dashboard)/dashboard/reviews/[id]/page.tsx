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
    .select('id, title, product_name, category, excerpt, content, image_url, rating, pros, cons, has_affiliate_links, disclosure_acknowledged, status, slug, moderation_score, moderation_flags, created_at, updated_at, reading_time_minutes, rejection_reason, meta_title, meta_description, scheduled_publish_at, product_slug')
    .eq('id', id)
    .single()

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
      }}
    />
  )
}
