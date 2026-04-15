import ReviewForm from '@/components/reviews/ReviewForm'

export const metadata = { title: 'New Review' }

export default function NewReviewPage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-8">New Review</h1>
      <ReviewForm />
    </div>
  )
}
