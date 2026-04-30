import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'

export async function LatestArticlesSection() {
  const supabase = await createClient()
  const { data: articles } = await supabase
    .from('articles')
    .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .limit(3)

  if (!articles || articles.length === 0) return null

  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-white">From the Blog</h2>
          <p className="text-gray-500 text-sm mt-1">Guides, skills, and dad wisdom</p>
        </div>
        <Link href="/articles" className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {articles.map((a, i) => (
          <Link
            key={a.id}
            href={`/articles/${a.slug}`}
            className="group flex flex-col bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-200"
          >
            {a.image_url ? (
              <div className="relative w-full h-44 bg-gray-800 shrink-0 overflow-hidden">
                <Image
                  src={a.image_url}
                  alt={a.title}
                  fill
                  priority={i === 0}
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
            ) : (
              <div className="w-full h-44 shrink-0 bg-gradient-to-br from-gray-800/50 to-gray-900/40 flex items-center justify-center">
                <span className="text-4xl opacity-40">📝</span>
              </div>
            )}
            <div className="p-5 flex flex-col flex-1">
              <span className="text-xs font-medium text-orange-500 uppercase tracking-widest mb-3">
                {a.category}
              </span>
              <h3 className="text-base font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1">
                {a.title}
              </h3>
              {a.excerpt && (
                <p className="text-gray-500 text-sm mt-2 line-clamp-2">{a.excerpt}</p>
              )}
              <div className="flex items-center justify-between mt-4 pt-4">
                <span className="text-xs text-gray-600">
                  {a.published_at ? new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </span>
                <div className="flex items-center gap-3">
                  {a.reading_time_minutes && (
                    <span className="text-xs text-gray-600">{a.reading_time_minutes} min read</span>
                  )}
                  <span className="text-xs text-orange-500 font-medium">Read →</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
