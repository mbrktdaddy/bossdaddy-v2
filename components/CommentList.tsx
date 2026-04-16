import { createClient } from '@/lib/supabase/server'

interface Props {
  contentType: 'review' | 'article'
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

  return (
    <div className="space-y-4">
      {comments.map((c) => {
        const author = (Array.isArray(c.profiles)
          ? c.profiles[0]
          : c.profiles as unknown as { username: string } | null
        )?.username ?? 'Anonymous'

        return (
          <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
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
          </div>
        )
      })}
    </div>
  )
}
