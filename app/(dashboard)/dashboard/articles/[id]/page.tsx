import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { ArticleWorkspace } from './_components/ArticleWorkspace'

export default async function ArticleWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: article } = await admin
    .from('articles')
    .select('id, title, category, excerpt, content, image_url, status, slug, moderation_score, moderation_flags, created_at, updated_at, reading_time_minutes, rejection_reason')
    .eq('id', id)
    .single()

  if (!article) {
    return (
      <div className="p-8 max-w-3xl">
        <Link href="/dashboard/articles" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors mb-6">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All articles
        </Link>
        <p className="text-red-400">Article not found. It may have been deleted.</p>
      </div>
    )
  }

  return (
    <ArticleWorkspace
      article={{
        ...article,
        moderation_flags: (article.moderation_flags ?? []) as string[],
      }}
    />
  )
}
