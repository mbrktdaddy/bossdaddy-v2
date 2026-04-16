'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  contentType: 'review' | 'article'
  contentId: string
}

export default function CommentForm({ contentType, contentId }: Props) {
  const router = useRouter()
  const [body, setBody]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    setError(null)

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: contentType, content_id: contentId, body: body.trim() }),
    })

    if (res.status === 401) {
      router.push('/login')
      return
    }

    const json = await res.json()
    if (!res.ok) { setError(json.error); setSubmitting(false); return }

    setSubmitted(true)
    setBody('')
    router.refresh()
  }

  if (submitted) {
    return (
      <div className="bg-green-950/30 border border-green-900/40 rounded-2xl p-5">
        <p className="text-green-400 font-semibold text-sm mb-1">Comment submitted</p>
        <p className="text-gray-400 text-sm">Your comment is pending approval and will appear once reviewed.</p>
        <button
          onClick={() => setSubmitted(false)}
          className="text-xs text-gray-500 hover:text-gray-300 mt-3 transition-colors"
        >
          Leave another comment
        </button>
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
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">{body.length}/2000</span>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={submitting || body.trim().length < 5}
          className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {submitting ? 'Posting...' : 'Post Comment'}
        </button>
      </div>
    </form>
  )
}
