import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReviewForm from '@/components/reviews/ReviewForm'

export const metadata = { title: 'Edit Review' }

export default async function EditReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: review } = await supabase
    .from('reviews')
    .select('id, title, product_name, category, excerpt, content, rating, pros, cons, has_affiliate_links, disclosure_acknowledged, image_url, status, rejection_reason')
    .eq('id', id)
    .eq('author_id', user!.id)
    .single()

  if (!review || !['draft', 'rejected'].includes(review.status)) notFound()

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Edit Review</h1>
        <p className="text-gray-500 text-sm mt-1">
          {review.status === 'rejected' ? 'Address the feedback below and resubmit.' : 'Continue working on your draft.'}
        </p>
      </div>

      {review.rejection_reason && (
        <div className={`mb-6 rounded-2xl p-5 ${
          review.status === 'rejected'
            ? 'bg-red-950/30 border border-red-900/40'
            : 'bg-yellow-950/30 border border-yellow-900/40'
        }`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
            review.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {review.status === 'rejected' ? 'Rejected — Feedback from moderation' : 'Edits requested by moderation'}
          </p>
          <p className="text-gray-300 text-sm leading-relaxed">{review.rejection_reason}</p>
        </div>
      )}

      <ReviewForm initialData={{ ...review, rejection_reason: review.rejection_reason ?? null }} />
    </div>
  )
}
