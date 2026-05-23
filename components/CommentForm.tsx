'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  contentType: 'review' | 'guide' | 'wishlist_item'
  contentId: string
  prompt?: string
}

export default function CommentForm({ contentType, contentId, prompt }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [body, setBody]                   = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [submitted, setSubmitted]         = useState<'approved' | 'pending' | false>(false)
  const [submittedBody, setSubmittedBody] = useState('')
  const [needsAuth, setNeedsAuth]         = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setError(null)
    setNeedsAuth(false)

    // Check auth client-side before hitting the server
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setNeedsAuth(true)
      return
    }

    setSubmitting(true)

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
      setSubmittedBody(body.trim())
      setSubmitted(json.comment?.status === 'approved' ? 'approved' : 'pending')
      setBody('')
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
      setSubmitting(false)
    }
  }

  if (submitted === 'approved') {
    return (
      <div className="space-y-3">
        <div className="bg-surface border border-green-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white shrink-0">
              ✓
            </div>
            <span className="text-sm font-medium text-green-700">Just posted</span>
            <span className="text-xs text-prose-faint">moments ago</span>
          </div>
          <p className="text-prose-muted text-sm leading-relaxed whitespace-pre-line">{submittedBody}</p>
        </div>
        <button
          onClick={() => { setSubmitted(false); setSubmittedBody('') }}
          className="text-xs text-prose-faint hover:text-prose transition-colors"
        >
          Leave another comment
        </button>
      </div>
    )
  }

  if (submitted === 'pending') {
    return (
      <div className="bg-surface border border-soft rounded-2xl p-5">
        <p className="font-semibold text-sm mb-1 text-prose-muted">Comment submitted</p>
        <p className="text-prose-muted text-sm">Your comment is pending approval and will appear once reviewed.</p>
        <button
          onClick={() => { setSubmitted(false); setSubmittedBody('') }}
          className="text-xs text-prose-faint hover:text-prose mt-3 transition-colors"
        >
          Leave another comment
        </button>
      </div>
    )
  }

  if (needsAuth) {
    return (
      <div className="bg-accent-tint border border-accent-border/40 rounded-2xl p-5">
        <p className="text-accent-text-soft font-semibold text-sm mb-1">Sign in to comment</p>
        <p className="text-prose-muted text-sm mb-4">You need to be signed in to leave a comment.</p>
        <div className="flex items-center gap-3">
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Sign In
          </Link>
          <button
            onClick={() => setNeedsAuth(false)}
            className="text-xs text-prose-faint hover:text-prose transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {prompt && (
        <p className="text-sm text-prose-muted italic">{prompt}</p>
      )}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={prompt ? 'Your answer...' : 'Share your thoughts... (sign in required)'}
        rows={4}
        maxLength={2000}
        className="w-full px-4 py-3 bg-surface border border-strong focus:border-accent rounded-xl text-prose placeholder:text-prose-faint focus:outline-none resize-none text-base sm:text-sm transition-colors"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-prose-faint shrink-0">{body.length}/2000</span>
        {error && <p className="text-red-600 text-xs flex-1">{error}</p>}
        <button
          type="submit"
          disabled={submitting || body.trim().length < 5}
          className="shrink-0 px-5 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {submitting ? 'Posting...' : 'Post Comment'}
        </button>
      </div>
    </form>
  )
}
