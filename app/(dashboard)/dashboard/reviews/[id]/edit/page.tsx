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
    .select('id, title, product_name, content, rating, has_affiliate_links, disclosure_acknowledged, status')
    .eq('id', id)
    .eq('author_id', user!.id)
    .single()

  if (!review || !['draft', 'rejected'].includes(review.status)) notFound()

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Edit Review</h1>
      {review.status === 'rejected' && (
        <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-2 mb-6">
          This review was rejected. Fix the issues and resubmit.
        </p>
      )}
      <ReviewForm initialData={review} />
    </div>
  )
}
