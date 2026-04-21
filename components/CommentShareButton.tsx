'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  commentId: string
  shareCount: number
}

export default function CommentShareButton({ commentId, shareCount }: Props) {
  const [count, setCount]     = useState(shareCount)
  const [copied, setCopied]   = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)

  async function handleShare() {
    const res = await fetch(`/api/comments/${commentId}/share`, { method: 'POST' })

    if (res.status === 401) {
      setNeedsAuth(true)
      return
    }

    if (res.ok) {
      const url = `${window.location.origin}${window.location.pathname}#comment-${commentId}`
      await navigator.clipboard.writeText(url).catch(() => {})
      setCount(c => c + 1)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (needsAuth) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-gray-600">
        <Link href="/login" className="text-orange-400 hover:text-orange-300 transition-colors">
          Sign in
        </Link>
        <span>to share</span>
      </span>
    )
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span>{count > 0 ? count : 'Share'}</span>
        </>
      )}
    </button>
  )
}
