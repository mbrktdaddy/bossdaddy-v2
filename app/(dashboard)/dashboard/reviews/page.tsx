import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-800 text-gray-400',
  pending: 'bg-yellow-900/50 text-yellow-400',
  approved: 'bg-green-900/50 text-green-400',
  rejected: 'bg-red-900/50 text-red-400',
}

export default async function MyReviewsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, title, product_name, status, rating, created_at, slug')
    .eq('author_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Reviews</h1>
        <Link
          href="/dashboard/reviews/new"
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Review
        </Link>
      </div>

      {!reviews?.length ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-4">No reviews yet, Boss.</p>
          <Link href="/dashboard/reviews/new" className="text-orange-400 hover:text-orange-300">
            Write your first one →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-800"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{r.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{r.product_name} · ★ {r.rating}</p>
              </div>

              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[r.status] ?? ''}`}
                >
                  {r.status}
                </span>

                {['draft', 'rejected'].includes(r.status) && (
                  <Link
                    href={`/dashboard/reviews/${r.id}/edit`}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Edit
                  </Link>
                )}

                {r.status === 'approved' && (
                  <Link
                    href={`/reviews/${r.slug}`}
                    className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
                    target="_blank"
                  >
                    View Live →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
