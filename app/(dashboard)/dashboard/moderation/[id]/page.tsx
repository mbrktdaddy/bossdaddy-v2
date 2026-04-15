'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'

interface Review {
  id: string
  title: string
  product_name: string
  content: string
  rating: number
  moderation_score: number | null
  moderation_flags: string[]
  has_affiliate_links: boolean
  disclosure_acknowledged: boolean
  status: string
}

export default function ModerationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [review, setReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/reviews/${id}`)
      .then((r) => r.json())
      .then(({ review }) => setReview(review))
      .finally(() => setLoading(false))
  }, [id])

  async function handleModerate(moderateAction: 'approve' | 'reject' | 'request_edits') {
    setSubmitting(true)
    await fetch(`/api/reviews/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: moderateAction, rejection_reason: reason }),
    })
    router.push('/dashboard/moderation')
    router.refresh()
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (!review) return <div className="p-8 text-red-400">Review not found.</div>

  const score = review.moderation_score
  const scoreColor =
    score === null ? 'text-gray-500'
      : score >= 0.7 ? 'text-red-400'
      : score >= 0.4 ? 'text-yellow-400'
      : 'text-green-400'

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-white mb-6">
        ← Back to queue
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{review.title}</h1>
          <p className="text-gray-400 text-sm mt-1">{review.product_name} · ★ {review.rating}</p>
        </div>
        {score !== null && (
          <div className="text-right">
            <p className={`text-3xl font-bold font-mono ${scoreColor}`}>{score.toFixed(2)}</p>
            <p className="text-xs text-gray-600">Claude risk score</p>
          </div>
        )}
      </div>

      {review.moderation_flags?.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-950/40 border border-yellow-800 rounded-xl">
          <p className="text-yellow-400 text-sm font-semibold mb-2">Flags</p>
          <ul className="list-disc list-inside space-y-1">
            {review.moderation_flags.map((f) => (
              <li key={f} className="text-yellow-300 text-sm">{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 mb-4 text-xs">
        <span className={`px-2.5 py-1 rounded-full ${review.has_affiliate_links ? 'bg-orange-900/50 text-orange-400' : 'bg-gray-800 text-gray-500'}`}>
          {review.has_affiliate_links ? 'Has affiliate links' : 'No affiliate links'}
        </span>
        <span className={`px-2.5 py-1 rounded-full ${review.disclosure_acknowledged ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
          {review.disclosure_acknowledged ? 'Disclosure acknowledged' : 'Disclosure NOT acknowledged'}
        </span>
      </div>

      <div
        className="prose prose-invert max-w-none bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: review.content }}
      />

      <div className="space-y-4">
        <p className="text-sm text-gray-400 font-semibold">Moderation decision</p>

        {action && (
          <div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={action === 'approve' ? 'Optional note...' : 'Reason (shown to author)'}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none h-24"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => { setAction('approve'); handleModerate('approve') }}
            disabled={submitting}
            className="px-5 py-2.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => setAction('request_edits')}
            disabled={submitting}
            className="px-5 py-2.5 bg-yellow-800 hover:bg-yellow-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Request Edits
          </button>
          <button
            onClick={() => setAction('reject')}
            disabled={submitting}
            className="px-5 py-2.5 bg-red-900 hover:bg-red-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Reject
          </button>

          {(action === 'reject' || action === 'request_edits') && (
            <button
              onClick={() => handleModerate(action as 'reject' | 'request_edits')}
              disabled={submitting || !reason}
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Confirm
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
