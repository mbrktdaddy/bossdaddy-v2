'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Props {
  contentType: 'review' | 'article'
  contentId: string
}

export default function CommentForm({ contentType, contentId }: Props) {
  const router = useRouter()
  const [body, setBody]             = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState<'approved' | 'pending' | false>(false)
  const [needsAuth, setNeedsAuth]   = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    setError(null)
    setNeedsAuth(false)

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: contentType, content_id: contentId, body: body.trim() }),
      })

      if (res.status === 401) {
        setNeedsAuth(true)
        setSubmitting(false)
        return
      }

      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Something went wrong.'); setSubmitting(false); return }

      setSubmitting(false)
      setSubmitted(json.comment?.status === 'approved' ? 'approved' : 'pending')
      setBody('')
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className={`border rounded-2xl p-5 ${submitted === 'approved' ? 'bg-green-950/30 border-green-900/40' : 'bg-gray-900 border-gray-800'}`}>
        <p className={`font-semibold text-sm mb-1 ${submitted === 'approved' ? 'text-green-400' : 'text-gray-300'}`}>
          {submitted === 'approved' ? 'Comment posted!' : 'Comment submitted'}
        </p>
        <p className="text-gray-400 text-sm">
          {submitted === 'approved'
            ? 'Your comment is now live. Refresh the page to see it.'
            : 'Your comment is pending approval and will appear once reviewed.'}
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="text-xs text-gray-500 hover:text-gray-300 mt-3 transition-colors"
        >
          Leave another comment
        </button>
      </div>
    )
  }

  if (needsAuth) {
    return (
      <div className="bg-orange-950/30 border border-orange-900/40 rounded-2xl p-5">
        <p className="text-orange-400 font-semibold text-sm mb-1">Sign in to comment</p>
        <p className="text-gray-400 text-sm mb-4">You need to be signed in to leave a comment.</p>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Sign In
          </Link>
          <button
            onClick={() => setNeedsAuth(false)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Share your thoughts... (sign in required)"
        rows={4}
        maxLength={2000}
        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 focus:border-orange-500 rounded-xl text-white placeholder-gray-500 focus:outline-none resize-none text-sm transition-colors"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-600 shrink-0">{body.length}/2000</span>
        {error && <p className="text-red-400 text-xs flex-1">{error}</p>}
        <button
          type="submit"
          disabled={submitting || body.trim().length < 5}
          className="shrink-0 px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {submitting ? 'Posting...' : 'Post Comment'}
        </button>
      </div>
    </form>
  )
}
