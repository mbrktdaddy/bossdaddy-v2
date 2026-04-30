import { createClient } from '@/lib/supabase/server'
import CommentShareButton from './CommentShareButton'
import LikeButton from './LikeButton'

interface Props {
  contentType: 'review' | 'guide'
  contentId: string
}

export default async function CommentList({ contentType, contentId }: Props) {
  const supabase = await createClient()

  const { data: comments } = await supabase
    .from('comments')
    .select('id, body, created_at, profiles(username)')
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .eq('status', 'approved')
    .order('created_at', { ascending: true })

  if (!comments?.length) return null

  // Fetch share counts for all comments in one query
  const commentIds = comments.map(c => c.id)
  const { data: shares } = await supabase
    .from('comment_shares')
    .select('comment_id')
    .in('comment_id', commentIds)

  const shareCountMap: Record<string, number> = {}
  for (const s of shares ?? []) {
    shareCountMap[s.comment_id] = (shareCountMap[s.comment_id] ?? 0) + 1
  }

  return (
    <div className="space-y-4">
      {comments.map((c) => {
        const author = (Array.isArray(c.profiles)
          ? c.profiles[0]
          : c.profiles as unknown as { username: string } | null
        )?.username ?? 'Anonymous'

        return (
          <div key={c.id} id={`comment-${c.id}`} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 scroll-mt-24">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-orange-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {author[0].toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-300">@{author}</span>
              <span className="text-xs text-gray-600">
                {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{c.body}</p>
            <div className="mt-3 pt-3 border-t border-gray-800/60 flex items-center justify-between">
              <LikeButton contentType="comment" contentId={c.id} size="sm" />
              <CommentShareButton commentId={c.id} shareCount={shareCountMap[c.id] ?? 0} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
