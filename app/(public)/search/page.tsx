import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCategoryBySlug } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'
import RatingScore from '@/components/RatingScore'
import BenchStrip from '@/components/BenchStrip'
import { buildSocialMetadata } from '@/lib/og'
import type { Metadata } from 'next'

export function generateMetadata(): Metadata {
 const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
 const meta = buildSocialMetadata({
   title: 'Search — Boss Daddy Life',
   description: 'Search Boss Daddy Life — reviews, guides, and gear for boss dads.',
   path: '/search',
   siteUrl,
   type: 'site',
   ogType: 'website',
 })
 return { ...meta, robots: { index: false } }
}

interface Props {
 searchParams: Promise<{ q?: string }>
}

// Bench-status → reader-facing label for product search hits (mirrors /bench).
const BENCH_STATUS_LABEL: Record<string, string> = {
 considering: 'Under consideration',
 queued: 'Coming soon',
 testing: 'Testing now',
}

export default async function SearchPage({ searchParams }: Props) {
 const { q } = await searchParams
 const query = q?.trim() ?? ''
 const supabase = await createClient()
 const admin = createAdminClient()

 // Products are matched with ilike (they have no search_vector), so the raw
 // query is interpolated into a PostgREST .or() filter. Strip the characters
 // PostgREST treats as filter delimiters / LIKE wildcards so an arbitrary
 // visitor query can't break the filter or inject a wildcard.
 const productLike = `%${query.replace(/[%,()\\]/g, ' ').trim()}%`

 const [{ data: reviews }, { data: articles }, { data: products }] = query.length >= 2
 ? await Promise.all([
 supabase
 .from('reviews')
 .select('id, slug, title, product_name, category, rating, excerpt, published_at')
 .eq('status', 'approved')
 .eq('is_visible', true)
 .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
 .limit(10),
 supabase
 .from('guides')
 .select('id, slug, title, category, excerpt, published_at, reading_time_minutes')
 .eq('status', 'approved')
 .eq('is_visible', true)
 .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
 .limit(10),
 // Bench pipeline products (considering/queued/testing) — the items with no
 // review yet, so nothing else in search surfaces them. Reviewed products
 // already appear via their review; archived/passed stay hidden. Admin client
 // mirrors the /bench page (avoids the products-RLS-for-anon trap).
 admin
 .from('products')
 .select('slug, name, brand, category, image_url, description, status')
 .in('status', ['considering', 'queued', 'testing'])
 .or(`name.ilike.${productLike},slug.ilike.${productLike},brand.ilike.${productLike}`)
 .order('priority', { ascending: false })
 .limit(10),
 ])
 : [{ data: null }, { data: null }, { data: null }]

 const total = (reviews?.length ?? 0) + (articles?.length ?? 0) + (products?.length ?? 0)

 return (
 <div className="max-w-4xl mx-auto px-6 py-12">

 {/* Search form */}
 <div className="mb-10">
 <h1 className="text-3xl font-black mb-6">Search</h1>
 <form action="/search">
 <div className="flex gap-3">
 <div className="relative flex-1">
 <input
 name="q"
 type="search"
 defaultValue={query}
 placeholder="Search reviews, articles, products..."
 autoFocus
 className="w-full pl-10 pr-4 py-3 bg-surface border border-strong focus:border-accent focus-visible:ring-2 focus-visible:ring-accent-hover/50 rounded-xl text-prose placeholder:text-prose-faint focus:outline-none transition-colors"
 />
 <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-prose-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 </div>
 <button
 type="submit"
 className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-colors"
 >
 Search
 </button>
 </div>
 </form>
 </div>

 {/* Results */}
 {query.length >= 2 && (
 <div>
 <p className="text-sm text-prose-faint mb-6">
 {total > 0
 ? `${total} result${total === 1 ? '' : 's'} for "${query}"`
 : `No results for "${query}"`}
 </p>

 {total === 0 && (
 <div className="text-center py-24 bg-surface/40 rounded-xl">
 <p className="text-prose-faint mb-2">Nothing matched that search.</p>
 <p className="text-prose-faint text-sm">Try a product name, category, or topic.</p>
 </div>
 )}

 {/* Review results */}
 {(reviews?.length ?? 0) > 0 && (
 <div className="mb-10">
 <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
 <p className="text-xs text-eyebrow font-semibold uppercase tracking-widest mb-3">Reviews</p>
 <div className="space-y-2">
 {reviews!.map((r) => {
 const cat = getCategoryBySlug(r.category)
 return (
 <Link
 key={r.id}
 href={`/reviews/${r.slug}`}
 className="flex items-start justify-between p-4 bg-surface border border-soft hover:border-accent-border/40 rounded-xl transition-colors group"
 >
 <div className="min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 {cat && <span className="flex items-center gap-1.5 text-[10px] sm:text-xs text-eyebrow uppercase tracking-widest font-semibold"><CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-accent-text shrink-0" /> {cat.label}</span>}
 </div>
 <p className="font-semibold text-sm group-hover:text-accent-text-soft transition-colors">{r.title}</p>
 {r.excerpt && <p className="text-prose-faint text-xs mt-1 line-clamp-1">{r.excerpt}</p>}
 </div>
 <RatingScore rating={r.rating ?? 0} />
 </Link>
 )
 })}
 </div>
 </div>
 )}

 {/* Product results — bench pipeline items */}
 {(products?.length ?? 0) > 0 && (
 <div className="mb-10">
 <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
 <p className="text-xs text-eyebrow font-semibold uppercase tracking-widest mb-3">On the Bench</p>
 <div className="space-y-2">
 {products!.map((p) => {
 const cat = getCategoryBySlug(p.category ?? '')
 return (
 <Link
 key={p.slug}
 href={`/bench/${p.slug}`}
 className="flex items-start justify-between p-4 bg-surface border border-soft hover:border-accent-border/40 rounded-xl transition-colors group"
 >
 <div className="min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 {cat && <span className="flex items-center gap-1.5 text-[10px] sm:text-xs text-eyebrow uppercase tracking-widest font-semibold"><CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-accent-text shrink-0" /> {cat.label}</span>}
 </div>
 <p className="font-semibold text-sm group-hover:text-accent-text-soft transition-colors">{p.name}</p>
 {p.description && <p className="text-prose-faint text-xs mt-1 line-clamp-1">{p.description}</p>}
 </div>
 <span className="text-xs text-accent-text font-medium ml-4 shrink-0 whitespace-nowrap">{BENCH_STATUS_LABEL[p.status] ?? 'On the bench'}</span>
 </Link>
 )
 })}
 </div>
 </div>
 )}

 {/* Article results */}
 {(articles?.length ?? 0) > 0 && (
 <div>
 <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
 <p className="text-xs text-eyebrow font-semibold uppercase tracking-widest mb-3">Guides</p>
 <div className="space-y-2">
 {articles!.map((a) => {
 const cat = getCategoryBySlug(a.category)
 return (
 <Link
 key={a.id}
 href={`/guides/${a.slug}`}
 className="flex items-start justify-between p-4 bg-surface border border-soft hover:border-accent-border/40 rounded-xl transition-colors group"
 >
 <div className="min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 {cat && <span className={`flex items-center gap-1 text-xs ${cat.accent}`}><CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-accent-text" /> {cat.label}</span>}
 {a.reading_time_minutes && (
 <span className="text-xs text-prose-faint">{a.reading_time_minutes} min read</span>
 )}
 </div>
 <p className="font-semibold text-sm group-hover:text-accent-text-soft transition-colors">{a.title}</p>
 {a.excerpt && <p className="text-prose-faint text-xs mt-1 line-clamp-1">{a.excerpt}</p>}
 </div>
 <span className="text-xs text-accent-text font-medium ml-4 shrink-0">Read</span>
 </Link>
 )
 })}
 </div>
 </div>
 )}
 </div>
 )}

 {query.length < 2 && !query && (
 <div className="text-center py-24 bg-surface/40 rounded-xl">
 <p className="text-prose-faint">Type something above to search reviews and guides.</p>
 </div>
 )}

 <div className="mt-16">
   <BenchStrip ctaText="See what's coming up" />
 </div>
 </div>
 )
}
