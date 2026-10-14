'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLoginHref } from '@/lib/use-login-href'
import { PILL_BASE, PILL_INACTIVE } from '@/components/ui/PillFilterStrip'

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

  // The square chip (Hard Goods, brand-guide §6): PILL_BASE is the geometry, so
  // liking changes colour and the heart's fill and NOTHING else. The "Like" /
  // "Liked" text swap and the old scale-110 on the icon both moved the box, so
  // the label is constant and aria-pressed carries the state for assistive tech.
  // Liked = the orange fill; white ink on an orange CHIP at 11px caps is
  // sanctioned (white BODY text on orange is not). `border-accent` keeps the
  // 2px edge, so unliked → liked never resizes. No hover change on the liked
  // fill: `hover:bg-accent-hover` is the hand-rolled-primary-button tell.
  // `size="sm"` (comment footers) only shrinks the heart — the 44px tap floor
  // stays, because a 36px target on a phone is the bug, not the density.
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike' : 'Like'}
      className={`${PILL_BASE} disabled:opacity-50 ${
        liked ? 'bg-accent text-white border-accent' : PILL_INACTIVE
      }`}
    >
      <svg
        className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'}
        fill={liked ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
      <span>Like</span>
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  )
}
