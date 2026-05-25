import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'
import RatingScore from '@/components/RatingScore'
import type { Metadata } from 'next'

export const metadata: Metadata = {
 title: 'Search — Boss Daddy Life',
 robots: { index: false },
}

interface Props {
 searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: Props) {
 const { q } = await searchParams
 const query = q?.trim() ?? ''
 const supabase = await createClient()

 const [{ data: reviews }, { data: articles }] = query.length >= 2
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
 ])
 : [{ data: null }, { data: null }]

 const total = (reviews?.length ?? 0) + (articles?.length ?? 0)

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
 className="w-full pl-10 pr-4 py-3 bg-surface focus:border-accent rounded-xl text-prose placeholder-gray-500 focus:outline-none transition-colors"
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
 <p className="text-gray-700 text-sm">Try a product name, category, or topic.</p>
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
 className="flex items-start justify-between p-4 bg-gradient-to-br from-surface to-surface/60 border border-soft hover:border-accent-border/40 rounded-xl transition-colors group"
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
 className="flex items-start justify-between p-4 bg-gradient-to-br from-surface to-surface/60 border border-soft hover:border-accent-border/40 rounded-xl transition-colors group"
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
 </div>
 )
}
