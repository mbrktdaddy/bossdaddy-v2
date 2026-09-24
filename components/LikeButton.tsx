'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLoginHref } from '@/lib/use-login-href'

interface Props {
  contentType: 'review' | 'guide' | 'comment'
  contentId: string
  size?: 'sm' | 'md'
}

export default function LikeButton({ contentType, contentId, size = 'md' }: Props) {
  const router = useRouter()
  const loginHref = useLoginHref()
  const [count, setCount]     = useState(0)
  const [liked, setLiked]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady]     = useState(false)

  useEffect(() => {
    fetch(`/api/likes?type=${contentType}&id=${contentId}`)
      .then(r => r.json())
      .then(({ count, liked }) => { setCount(count); setLiked(liked); setReady(true) })
      .catch(() => setReady(true))
  }, [contentType, contentId])

  async function toggle() {
    setLoading(true)
    const res = await fetch('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: contentType, content_id: contentId }),
    })

    if (res.status === 401) {
      router.push(loginHref)
      return
    }

    const json = await res.json()
    if (res.ok) { setCount(json.count); setLiked(json.liked) }
    setLoading(false)
  }

  if (!ready) return null

  if (size === 'sm') {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        aria-pressed={liked}
        aria-label={liked ? 'Unlike' : 'Like'}
        className={`flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 ${
          liked ? 'text-red-700' : 'text-prose-faint hover:text-prose-muted'
        }`}
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${liked ? 'scale-110' : ''}`}
          fill={liked ? 'currentColor' : 'none'}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <span>{count > 0 ? count : liked ? 'Liked' : 'Like'}</span>
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike' : 'Like'}
      className={`flex items-center gap-2 h-11 px-4 rounded-full border text-sm font-semibold transition-colors disabled:opacity-50 ${
        liked
          ? 'bg-red-500/10 border-red-500/40 text-red-400'
          : 'bg-surface border-soft text-prose-muted hover:border-strong hover:text-prose hover:bg-surface-raised'
      }`}
    >
      <svg
        className={`w-4 h-4 transition-transform ${liked ? 'scale-110' : ''}`}
        fill={liked ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
      <span>{liked ? 'Liked' : 'Like'}</span>
      {count > 0 && <span className="tabular-nums opacity-80">{count}</span>}
    </button>
  )
}
