import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCategoryBySlug } from '@/lib/categories'
import RatingScore from '@/components/RatingScore'
import type { Metadata } from 'next'

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
 return {
 title: `@${username} — Boss Daddy Life`,
 description: `Reviews and articles by @${username} on Boss Daddy Life.`,
 }
}

export default async function AuthorPage({ params }: Props) {
 const { username } = await params
 const supabase = await createClient()

 const { data: profile } = await supabase
 .from('profiles')
 .select('id, username, role, display_name, tagline, bio, avatar_url')
 .eq('username', username)
 .single()

 if (!profile) notFound()

 const [{ data: reviews }, { data: articles }] = await Promise.all([
 supabase
 .from('reviews')
 .select('id, slug, title, product_name, category, rating, excerpt, published_at')
 .eq('author_id', profile.id)
 .eq('status', 'approved')
 .eq('is_visible', true)
 .order('published_at', { ascending: false })
 .limit(100),
 supabase
 .from('guides')
 .select('id, slug, title, category, excerpt, published_at, reading_time_minutes')
 .eq('author_id', profile.id)
 .eq('status', 'approved')
 .eq('is_visible', true)
 .order('published_at', { ascending: false })
 .limit(100),
 ])

 const totalReviews = reviews?.length ?? 0
 const totalGuides = articles?.length ?? 0

 return (
 <div className="max-w-4xl mx-auto px-6 py-12">

 {/* Profile header */}
 <div className="mb-12 pb-10">
 <div className="flex items-start gap-5">
 {profile.avatar_url ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={profile.avatar_url}
 alt={profile.display_name ?? username}
 className="w-16 h-16 rounded-2xl object-cover shrink-0"
 />
 ) : (
 <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-600 to-orange-800 flex items-center justify-center text-2xl font-black text-white shrink-0">
 {(profile.display_name ?? username)[0].toUpperCase()}
 </div>
 )}
 <div>
 <h1 className="text-3xl font-black mb-1">{profile.display_name ?? `@${username}`}</h1>
 <p className="text-sm text-gray-500">
 <span className="text-orange-500">@{username}</span>
 <span className="mx-2 text-gray-700">·</span>
 {profile.role === 'admin' ? 'Editor' : 'Contributor'}
 </p>
 {profile.tagline && (
 <p className="text-xs text-orange-500/80 uppercase tracking-widest font-semibold mt-2">
 {profile.tagline}
 </p>
 )}
 <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
 <span><span className="text-white font-semibold">{totalReviews}</span> {totalReviews === 1 ? 'review' : 'reviews'}</span>
 <span><span className="text-white font-semibold">{totalGuides}</span> {totalGuides === 1 ? 'guide' : 'guides'}</span>
 </div>
 </div>
 </div>
 {profile.bio && (
 <p className="mt-6 text-gray-400 text-sm leading-relaxed max-w-2xl">{profile.bio}</p>
 )}
 </div>

 {/* Reviews */}
 {totalReviews > 0 && (
 <div className="mb-12">
 <h2 className="text-lg font-black mb-5">Reviews</h2>
 <div className="space-y-2">
 {reviews!.map((r) => {
 const cat = getCategoryBySlug(r.category)
 return (
 <Link
 key={r.id}
 href={`/reviews/${r.slug}`}
 className="flex items-center justify-between p-4 bg-gray-900 rounded-2xl transition-colors group"
 >
 <div className="min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2 py-0.5 rounded-full">
 {r.product_name}
 </span>
 {cat && <span className={`text-xs ${cat.accent}`}>{cat.icon} {cat.label}</span>}
 </div>
 <p className="text-sm font-semibold group-hover:text-orange-400 transition-colors truncate">{r.title}</p>
 {r.published_at && (
 <p className="text-xs text-gray-600 mt-0.5">
 {new Date(r.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
 </p>
 )}
 </div>
 <RatingScore rating={r.rating} />
 </Link>
 )
 })}
 </div>
 </div>
 )}

 {/* Articles */}
 {totalGuides > 0 && (
 <div>
 <h2 className="text-lg font-black mb-5">Guides</h2>
 <div className="space-y-2">
 {articles!.map((a) => {
 const cat = getCategoryBySlug(a.category)
 return (
 <Link
 key={a.id}
 href={`/guides/${a.slug}`}
 className="flex items-center justify-between p-4 bg-gray-900 rounded-2xl transition-colors group"
 >
 <div className="min-w-0">
 <div className="flex items-center gap-2 mb-1">
 {cat && <span className={`text-xs ${cat.accent}`}>{cat.icon} {cat.label}</span>}
 </div>
 <p className="text-sm font-semibold group-hover:text-orange-400 transition-colors truncate">{a.title}</p>
 {a.published_at && (
 <p className="text-xs text-gray-600 mt-0.5">
 {new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
 </p>
 )}
 </div>
 {a.reading_time_minutes && (
 <span className="text-xs text-gray-600 ml-4 shrink-0">{a.reading_time_minutes} min</span>
 )}
 </Link>
 )
 })}
 </div>
 </div>
 )}

 {totalReviews === 0 && totalGuides === 0 && (
 <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
 <p className="text-gray-600">No published content yet.</p>
 </div>
 )}

 </div>
 )
}
