'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUserId } from '@/lib/use-current-user-id'
import { useConfirm } from '@/components/ui/useConfirm'

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
  const [error, setError] = useState<string | null>(null)
  const { confirm: askConfirm, dialog } = useConfirm()

  if (userId !== authorId) return null

  async function handleDelete() {
    if (!(await askConfirm({
      title: 'Delete your comment?',
      body: 'This can’t be undone.',
      confirmLabel: 'Delete',
      danger: true,
    }))) return
    setError(null)
    setDeleting(true)
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
    if (res.ok) {
      router.refresh()
      return
    }
    setDeleting(false)
    setError('Could not delete your comment. Please try again.')
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex min-h-11 items-center px-2 text-xs text-prose-faint hover:text-danger-ink transition-colors disabled:opacity-50"
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
      {error && <span role="alert" className="text-xs font-medium text-danger-ink">{error}</span>}
      {dialog}
    </>
  )
}
