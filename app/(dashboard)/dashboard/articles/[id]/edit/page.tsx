import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ArticleForm from '@/components/articles/ArticleForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditArticlePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: article } = await supabase
    .from('articles')
    .select('id, title, category, content, excerpt, image_url, status, rejection_reason')
    .eq('id', id)
    .eq('author_id', user!.id)
    .single()

  if (!article || !['draft', 'rejected'].includes(article.status)) notFound()

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Edit Article</h1>
        <p className="text-gray-500 text-sm mt-1">
          {article.status === 'rejected' ? 'Address the feedback below and resubmit.' : 'Continue working on your draft.'}
        </p>
      </div>

      {/* Moderation feedback */}
      {article.rejection_reason && (
        <div className={`mb-6 rounded-2xl p-5 ${
          article.status === 'rejected'
            ? 'bg-red-950/30 border border-red-900/40'
            : 'bg-yellow-950/30 border border-yellow-900/40'
        }`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
            article.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {article.status === 'rejected' ? 'Rejected — Feedback from moderation' : 'Edits requested by moderation'}
          </p>
          <p className="text-gray-300 text-sm leading-relaxed">{article.rejection_reason}</p>
        </div>
      )}

      <ArticleForm
        initialData={{
          id: article.id,
          title: article.title,
          category: article.category,
          content: article.content,
          excerpt: article.excerpt ?? '',
          image_url: article.image_url ?? null,
          rejection_reason: article.rejection_reason ?? null,
        }}
      />
    </div>
  )
}
