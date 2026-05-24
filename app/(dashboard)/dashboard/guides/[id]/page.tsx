import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { GuideWorkspace } from './_components/GuideWorkspace'

export default async function GuideWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: guide } = await admin
    .from('guides')
    .select('id, title, category, excerpt, content, image_url, status, slug, moderation_score, moderation_flags, created_at, updated_at, reading_time_minutes, rejection_reason, meta_title, meta_description, scheduled_publish_at, tldr, key_takeaways, faqs')
    .eq('id', id)
    .single()

  const { data: tagRows } = await admin
    .from('guide_tags').select('tag_slug').eq('guide_id', id)
  const guideTags = (tagRows ?? []).map((r) => r.tag_slug)

  if (!guide) {
    return (
      <div className="p-8 max-w-3xl">
        <Link href="/dashboard/guides" className="inline-flex items-center gap-2 text-xs text-prose-faint hover:text-prose transition-colors mb-6">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All articles
        </Link>
        <p className="text-red-300">Guide not found. It may have been deleted.</p>
      </div>
    )
  }

  return (
    <GuideWorkspace
      guide={{
        ...guide,
        moderation_flags: (guide.moderation_flags ?? []) as string[],
        key_takeaways:    (guide.key_takeaways ?? []) as string[],
        faqs:             (guide.faqs ?? []) as { question: string; answer: string }[],
        tags:             guideTags,
      }}
    />
  )
}
