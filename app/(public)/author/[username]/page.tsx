import { notFound } from 'next/navigation'
import { createAnonClient } from '@/lib/supabase/anon'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCategoryBySlug } from '@/lib/categories'
import ContentRow from '@/components/ContentRow'
import { LabelBlock } from '@/components/ui/LabelBlock'
import BenchStrip from '@/components/BenchStrip'
import PipelineCounter from '@/components/PipelineCounter'
import MessageUserButton from '@/components/messages/MessageUserButton'
import { EmptyState } from '@/components/ui/EmptyState'
import EditorialHeader from '@/components/EditorialHeader'
import type { Metadata } from 'next'
import { buildSocialMetadata } from '@/lib/og'

export const revalidate = 3600

interface Props {
 params: Promise<{ username: string }>
}

export async function generateStaticParams() {
 const admin = createAdminClient()
 const [{ data: reviews }, { data: articles }] = await Promise.all([
 admin.from('reviews').select('author_id').eq('status', 'approved').eq('is_visible', true),
 admin.from('guides').select('author_id').eq('status', 'approved').eq('is_visible', true),
 ])
 const ids = new Set<string>()
 for (const r of reviews ?? []) if (r.author_id) ids.add(r.author_id)
 for (const a of articles ?? []) if (a.author_id) ids.add(a.author_id)
 if (ids.size === 0) return []
 const { data: profiles } = await admin
 .from('profiles')
 .select('username')
 .in('id', Array.from(ids))
 return (profiles ?? []).map(({ username }) => ({ username }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
 const { username } = await params
 const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
 return buildSocialMetadata({
   title: `@${username} — Boss Daddy Life`,
   description: `Reviews and articles by @${username} on Boss Daddy Life.`,
   path: `/author/${username}`,
   siteUrl,
   ogTitle: `@${username} | Boss Daddy Life`,
   type: 'site',
   ogType: 'website',
 })
}

export default async function AuthorPage({ params }: Props) {
 const { username } = await params
 const supabase = createAnonClient()

 const { data: profile } = await supabase
 .from('profiles')
 .select('id, username, role, display_name, tagline, bio, avatar_url')
 .eq('username', username)
 .single()

 if (!profile) notFound()

 // ⚠️ THIS ROUTE IS FOR AUTHORS. WITHOUT THIS GATE IT RENDERED FOR EVERY MEMBER,
 //    and three things followed from that:
 //
 //    • Every member had a public page they could neither see nor edit, labelling
 //      them "Contributor" (the role line below) over an empty portfolio.
 //      BioForm's own comment states members don't have one — this is what made
 //      that true rather than aspirational.
 //
 //    • IT WAS A MEMBERSHIP ORACLE, and an unauthenticated one. Usernames default
 //      to the email local part (migration 001: split_part(email, '@', 1)), so
 //      /author/<local-part> answered "is this address registered here" with 200
 //      vs 404 — no session, no rate limit, cached an hour, and ignoring
 //      profiles.discoverable_by_email entirely. /api/members/search goes to real
 //      lengths to avoid being that exact oracle: auth required, 30/min, exact
 //      match only, address never echoed. One route can't undo the other's care.
 //
 //    • E2E accounts were reachable the same way (/author/bd-verify-a et al).
 //
 //    Kept as notFound() rather than a redirect: for anyone who isn't an author
 //    there is genuinely nothing here, and 404 is the honest answer — it also
 //    keeps the oracle shut, which a redirect would not. If a real member profile
 //    is ever built it belongs at its own route with its own auth rules, not by
 //    loosening this one.
 if (profile.role !== 'author' && profile.role !== 'admin') notFound()

 const [{ data: reviews }, { data: articles }] = await Promise.all([
 supabase
 .from('reviews')
 .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
 .eq('author_id', profile.id)
 .eq('status', 'approved')
 .eq('is_visible', true)
 .order('published_at', { ascending: false })
 .limit(100),
 supabase
 .from('guides')
 .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
 .eq('author_id', profile.id)
 .eq('status', 'approved')
 .eq('is_visible', true)
 .order('published_at', { ascending: false })
 .limit(100),
 ])

 const fmt = (d: string | null) =>
 d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

 const totalReviews = reviews?.length ?? 0
 const totalGuides = articles?.length ?? 0

 return (
 <div className="max-w-4xl mx-auto px-6 py-12">

 {/* Profile header — the PageHeader lockup (label block, uppercase H1, 3px rule)
     with the portrait and byline beside it. Portrait is SQUARE on purpose
     (author portraits are; member avatars are round). */}
 <header className="mb-12 pb-8 border-b-[3px] border-chrome">
 <div className="flex items-start gap-5">
 {profile.avatar_url ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={profile.avatar_url}
 alt={profile.display_name ?? username}
 className="w-16 h-16 rounded-sm object-cover shrink-0"
 />
 ) : (
 <div className="w-16 h-16 rounded-sm bg-chrome flex items-center justify-center text-2xl font-display font-black text-white shrink-0">
 {(profile.display_name ?? username)[0].toUpperCase()}
 </div>
 )}
 <div className="min-w-0">
 <LabelBlock>{profile.role === 'admin' ? 'Editor' : 'Contributor'}</LabelBlock>
 <h1 className="font-black text-prose uppercase text-2xl sm:text-3xl leading-[1.05] tracking-[-0.01em] mt-3">
 {profile.display_name ?? `@${username}`}
 </h1>
 <p className="text-sm text-prose-faint mt-1.5">
 <span className="text-accent-text">@{username}</span>
 </p>
 {profile.tagline && (
 <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mt-2">
 {profile.tagline}
 </p>
 )}
 <div className="flex items-center gap-4 mt-3 text-sm text-prose-faint">
 <span><span className="text-prose font-semibold">{totalReviews}</span> {totalReviews === 1 ? 'review' : 'reviews'}</span>
 <span><span className="text-prose font-semibold">{totalGuides}</span> {totalGuides === 1 ? 'guide' : 'guides'}</span>
 </div>
 <div className="mt-4">
 <MessageUserButton targetUserId={profile.id} />
 </div>
 </div>
 </div>
 {profile.bio && (
 <p className="mt-6 text-prose-muted text-sm leading-relaxed max-w-2xl">{profile.bio}</p>
 )}
 </header>

 {/* Reviews */}
 {totalReviews > 0 && (
 <div className="mb-12">
 <EditorialHeader eyebrow="By this author" title="Reviews" />
 <div className="border-y border-soft">
 {reviews!.map((r, i) => (
 <ContentRow
 key={r.id}
 href={`/reviews/${r.slug}`}
 eyebrow={getCategoryBySlug(r.category)?.label ?? r.category}
 headline={r.title}
 sub={r.product_name}
 excerpt={r.excerpt}
 meta={fmt(r.published_at)}
 rating={r.rating ?? 0}
 imageUrl={r.image_url}
 isLast={i === reviews!.length - 1}
 />
 ))}
 </div>
 </div>
 )}

 {/* Articles */}
 {totalGuides > 0 && (
 <div>
 <EditorialHeader eyebrow="By this author" title="Guides" />
 <div className="border-y border-soft">
 {articles!.map((a, i) => (
 <ContentRow
 key={a.id}
 href={`/guides/${a.slug}`}
 eyebrow={getCategoryBySlug(a.category)?.label ?? a.category}
 headline={a.title}
 excerpt={a.excerpt}
 meta={[fmt(a.published_at), a.reading_time_minutes ? `${a.reading_time_minutes} min read` : null].filter(Boolean).join(' · ') || null}
 imageUrl={a.image_url}
 isLast={i === articles!.length - 1}
 />
 ))}
 </div>
 </div>
 )}

 {totalReviews === 0 && totalGuides === 0 && (
 <EmptyState title="No published content yet." />
 )}

 <div className="mt-12 pt-8 border-t border-soft">
   <PipelineCounter />
 </div>

 <div className="mt-16">
   <BenchStrip ctaText="See what's on the bench" />
 </div>

 </div>
 )
}
