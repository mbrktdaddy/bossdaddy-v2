import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { PLATFORMS } from '@/lib/social-platforms'
import SocialPostList from './_components/SocialPostList'
import GenerateDrawer from './_components/GenerateDrawer'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ platform?: string; status?: string }>
}

export default async function SocialPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect('/login')

  const { platform = 'x', status = 'all' } = await searchParams

  const admin = createAdminClient()

  // Posts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let postsQuery = (admin as any)
    .from('social_posts')
    .select('id, platform, content, status, source_type, source_title, link_url, image_url, notes, posted_at, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('platform', platform)
    .order('created_at', { ascending: false })
  if (status !== 'all') postsQuery = postsQuery.eq('status', status)
  const { data: posts } = await postsQuery

  // Hashtag presets for this platform
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: presets } = await (admin as any)
    .from('hashtag_presets')
    .select('id, name, platform, tags, created_at')
    .eq('user_id', user.id)
    .eq('platform', platform)
    .order('created_at', { ascending: true })

  // Source links for link picker and generate drawer (reviews + guides = user's own; merch = all)
  const [{ data: reviews }, { data: guides }, { data: merch }] = await Promise.all([
    supabase.from('reviews').select('id, title, slug').eq('author_id', user.id).order('title'),
    supabase.from('guides').select('id, title, slug').eq('author_id', user.id).order('title'),
    supabase.from('merch').select('id, name, slug').neq('status', 'archived').order('name'),
  ])

  const sourceLinks = {
    reviews: reviews ?? [],
    guides:  guides  ?? [],
    merch:   (merch ?? []).map((m) => ({ id: m.id, title: m.name, slug: m.slug })),
  }

  const currentPlatform = PLATFORMS.find((p) => p.id === platform) ?? PLATFORMS[0]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-prose">Social Posts</h1>
          <p className="text-sm text-prose-muted mt-0.5">Generate, edit, and copy posts to your accounts.</p>
        </div>
        <GenerateDrawer
          reviews={sourceLinks.reviews}
          guides={sourceLinks.guides}
          currentPlatform={platform}
        />
      </div>

      {/* Platform tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide">
        {PLATFORMS.map((p) => (
          <a
            key={p.id}
            href={`/dashboard/social?platform=${p.id}&status=${status}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              p.id === platform
                ? 'bg-accent text-white'
                : 'text-prose-muted hover:bg-surface-raised hover:text-prose'
            }`}
          >
            {p.id === 'x' ? 'X (Twitter)' : (
              <span>{p.label} <span className="text-xs opacity-50">soon</span></span>
            )}
          </a>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-6">
        {['all', 'draft', 'ready', 'posted'].map((s) => (
          <a
            key={s}
            href={`/dashboard/social?platform=${platform}&status=${s}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
              s === status
                ? 'bg-zinc-800 text-prose'
                : 'text-prose-faint hover:text-prose'
            }`}
          >
            {s}
          </a>
        ))}
      </div>

      {/* Posts list + presets panel */}
      <SocialPostList
        posts={posts ?? []}
        charLimit={currentPlatform.charLimit}
        sourceLinks={sourceLinks}
        initialPresets={presets ?? []}
        platform={platform}
      />
    </div>
  )
}
