'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUserId } from '@/lib/use-current-user-id'

interface Props {
  commentId: string
  authorId: string
}

// Author-only delete control on the public comment list. The list itself is a
// cookie-free anon Server Component (kept static — audit H3), so ownership is
// resolved here in the browser after hydration; the button simply doesn't
// render for anyone but the author. The API + RLS (migration 123) enforce
// ownership for real — this is only the affordance.
export default function CommentDeleteButton({ commentId, authorId }: Props) {
  const router = useRouter()
  const userId = useCurrentUserId()
  const [deleting, setDeleting] = useState(false)

  if (userId !== authorId) return null

  async function handleDelete() {
    if (!window.confirm('Delete your comment? This can’t be undone.')) return
    setDeleting(true)
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
    if (res.ok) {
      router.refresh()
      return
    }
    setDeleting(false)
    window.alert('Could not delete your comment. Please try again.')
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs text-prose-faint hover:text-danger-ink transition-colors disabled:opacity-50"
    >
      {deleting ? 'Deleting…' : 'Delete'}
    </button>
  )
}
