import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-cache'
import { serializeForX } from '@/lib/x/serialize'
import { ArticleWorkspace, type ArticleRow } from './_components/ArticleWorkspace'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ArticleEditorPage({ params }: Props) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect('/login?next=/dashboard/social')

  // X Studio is admin-only as a FEATURE (RLS stays owner-scoped as defense-in-depth).
  await requireAdmin()

  const { id } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('social_articles')
    .select('id, title, body_html, cover_image_url, source_type, source_id, source_title, status, scheduled_at, external_url, posted_at, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!data) notFound()

  const { html: xHtml, dropped } = serializeForX(data.body_html as string | null)

  return <ArticleWorkspace article={data as ArticleRow} initialXHtml={xHtml} initialDropped={dropped} />
}
