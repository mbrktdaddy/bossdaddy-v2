import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCategoryBySlug } from '@/lib/categories'
import { ScoreRing } from '../../_components/ScoreRing'
import { ModerationDecision } from '../../_components/ModerationDecision'

export default async function ArticleModerationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Verify caller is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // Fetch article via admin client — bypasses RLS so pending articles are always accessible
  const admin = createAdminClient()
  const { data: article } = await admin
    .from('articles')
    .select('id, title, category, excerpt, content, image_url, moderation_score, moderation_flags, status, slug')
    .eq('id', id)
    .single()

  if (!article) {
    return (
      <div className="p-8 max-w-3xl">
        <Link href="/dashboard/moderation" className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to queue
        </Link>
        <p className="text-red-400">Article not found. It may have been deleted or already moderated.</p>
      </div>
    )
  }

  if (article.status !== 'pending') {
    return (
      <div className="p-8 max-w-3xl">
        <Link href="/dashboard/moderation" className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to queue
        </Link>
        <p className="text-yellow-400">
          This article is no longer pending — current status: <strong>{article.status}</strong>.
        </p>
      </div>
    )
  }

  const flags = (article.moderation_flags ?? []) as string[]
  const category = getCategoryBySlug(article.category)

  return (
    <div className="p-4 sm:p-8 max-w-3xl">

      {/* Back */}
      <Link
        href="/dashboard/moderation"
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back to queue
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950/40 text-blue-400 border border-blue-900/30">Article</span>
            {category && (
              <span className={`text-xs ${category.accent}`}>{category.icon} {category.label}</span>
            )}
          </div>
          <h1 className="text-xl font-black leading-tight">{article.title}</h1>
          {article.excerpt && (
            <p className="text-gray-400 text-sm mt-1">{article.excerpt}</p>
          )}
        </div>
        <ScoreRing score={article.moderation_score as number | null} />
      </div>

      {/* Hero image */}
      {article.image_url && (
        <div className="mb-6 rounded-2xl overflow-hidden border border-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.image_url} alt="Hero" className="w-full h-48 object-cover" />
        </div>
      )}

      {/* Flags */}
      {flags.length > 0 && (
        <div className="mb-6 bg-red-950/30 border border-red-900/40 rounded-2xl p-5">
          <p className="text-red-400 text-xs font-semibold uppercase tracking-wide mb-3">Moderation Flags</p>
          <div className="space-y-1.5">
            {flags.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-300">
                <span className="text-red-600 mt-0.5 shrink-0">⚑</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content preview */}
      <div
        className="prose prose-invert prose-sm max-w-none bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 max-h-[480px] overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* Decision panel — client component */}
      <ModerationDecision id={id} contentType="articles" />
    </div>
  )
}
