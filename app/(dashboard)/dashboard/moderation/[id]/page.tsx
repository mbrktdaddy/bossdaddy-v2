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

function ScoreRing({ score }: { score: number }) {
  const level = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low'
  const config = {
    high:   { color: 'text-red-400',    ring: '#ef4444', label: 'High Risk' },
    medium: { color: 'text-yellow-400', ring: '#eab308', label: 'Needs Review' },
    low:    { color: 'text-green-400',  ring: '#22c55e', label: 'Low Risk' },
  }[level]

  const pct = score * 100
  const circumference = 2 * Math.PI * 20
  const dash = (pct / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="#1f2937" strokeWidth="4" />
          <circle
            cx="24" cy="24" r="20" fill="none"
            stroke={config.ring} strokeWidth="4"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-black font-mono ${config.color}`}>{score.toFixed(2)}</span>
        </div>
      </div>
      <p className={`text-xs font-medium mt-1 ${config.color}`}>{config.label}</p>
    </div>
  )
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
  const [pendingAction, setPendingAction] = useState<'reject' | 'request_edits' | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/reviews/${id}`)
      .then((r) => r.json())
      .then(({ review }) => setReview(review))
      .finally(() => setLoading(false))
  }, [id])

  async function handleModerate(action: 'approve' | 'reject' | 'request_edits') {
    setSubmitting(true)
    await fetch(`/api/reviews/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, rejection_reason: reason }),
    })
    router.push('/dashboard/moderation')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-500">
        <div className="w-4 h-4 border-2 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
        Loading review...
      </div>
    )
  }

  if (!review) {
    return <div className="p-8 text-red-400">Review not found.</div>
  }

  const score = review.moderation_score

  return (
    <div className="p-8 max-w-3xl">

      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back to queue
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="min-w-0 pr-6">
          <h1 className="text-xl font-black leading-tight">{review.title}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {review.product_name} · {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
          </p>
        </div>
        {score !== null && <ScoreRing score={score} />}
      </div>

      {/* Flags */}
      {review.moderation_flags?.length > 0 && (
        <div className="mb-6 bg-red-950/30 border border-red-900/40 rounded-2xl p-5">
          <p className="text-red-400 text-xs font-semibold uppercase tracking-wide mb-3">Claude Flags</p>
          <div className="space-y-1.5">
            {review.moderation_flags.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-300">
                <span className="text-red-600 mt-0.5 shrink-0">⚑</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance badges */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <span className={`text-xs px-3 py-1.5 rounded-xl border font-medium ${
          review.has_affiliate_links
            ? 'bg-orange-950/40 text-orange-400 border-orange-900/40'
            : 'bg-gray-900 text-gray-500 border-gray-800'
        }`}>
          {review.has_affiliate_links ? '⚠ Has affiliate links' : '✓ No affiliate links'}
        </span>
        <span className={`text-xs px-3 py-1.5 rounded-xl border font-medium ${
          review.disclosure_acknowledged
            ? 'bg-green-950/40 text-green-400 border-green-900/40'
            : 'bg-red-950/40 text-red-400 border-red-900/40'
        }`}>
          {review.disclosure_acknowledged ? '✓ Disclosure acknowledged' : '✗ Disclosure missing'}
        </span>
      </div>

      {/* Content preview */}
      <div
        className="prose prose-invert prose-sm max-w-none bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 max-h-96 overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: review.content }}
      />

      {/* Decision panel */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <p className="text-sm font-semibold text-gray-300 mb-4">Moderation Decision</p>

        {!pendingAction ? (
          <div className="flex gap-3">
            <button
              onClick={() => handleModerate('approve')}
              disabled={submitting}
              className="flex-1 py-3 bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              ✓ Approve
            </button>
            <button
              onClick={() => setPendingAction('request_edits')}
              disabled={submitting}
              className="flex-1 py-3 bg-yellow-900/60 hover:bg-yellow-900 disabled:opacity-50 text-yellow-300 text-sm font-semibold rounded-xl transition-colors border border-yellow-900/40"
            >
              ↩ Request Edits
            </button>
            <button
              onClick={() => setPendingAction('reject')}
              disabled={submitting}
              className="flex-1 py-3 bg-red-950/60 hover:bg-red-900/60 disabled:opacity-50 text-red-400 text-sm font-semibold rounded-xl transition-colors border border-red-900/40"
            >
              ✗ Reject
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              {pendingAction === 'request_edits'
                ? 'What changes does the author need to make?'
                : 'Why is this being rejected? (shown to author)'}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Be specific and helpful..."
              className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none h-24"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => handleModerate(pendingAction)}
                disabled={submitting || !reason.trim()}
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {submitting ? 'Sending...' : `Confirm ${pendingAction === 'request_edits' ? 'Request' : 'Rejection'}`}
              </button>
              <button
                onClick={() => { setPendingAction(null); setReason('') }}
                disabled={submitting}
                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
