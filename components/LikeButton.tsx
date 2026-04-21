'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  contentType: 'review' | 'article' | 'comment'
  contentId: string
  size?: 'sm' | 'md'
}

export default function LikeButton({ contentType, contentId, size = 'md' }: Props) {
  const router = useRouter()
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
      router.push('/login')
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
        className={`flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 ${
          liked ? 'text-red-400' : 'text-gray-600 hover:text-gray-400'
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
      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all disabled:opacity-50 ${
        liked
          ? 'bg-red-950/50 border-red-900/60 text-red-400 hover:bg-red-900/40'
          : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
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
      <span>{count > 0 ? count : ''} {liked ? 'Liked' : 'Like'}</span>
    </button>
  )
}
