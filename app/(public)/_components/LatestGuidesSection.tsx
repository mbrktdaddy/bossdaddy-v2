import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'

// Editorial numbered-list treatment (intentionally different from Recent Reviews'
// card grid) so the homepage doesn't read as "same card 3x in a row, twice."
export async function LatestGuidesSection() {
  const supabase = await createClient()
  const { data: guides } = await supabase
    .from('guides')
    .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .limit(3)

  if (!guides || guides.length === 0) return null

  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">— Latest Guides</p>
          <h2 className="text-2xl font-black text-white">Skills, builds, and hard-won dad wisdom.</h2>
        </div>
        <Link href="/guides" className="hidden sm:inline text-sm text-orange-400 hover:text-orange-300 transition-colors shrink-0">
          View all →
        </Link>
      </div>

      <div className="divide-y divide-gray-800/60">
        {guides.map((a, i) => (
          <Link
            key={a.id}
            href={`/guides/${a.slug}`}
            className="group flex items-center gap-5 py-6 -mx-4 px-4 rounded-2xl hover:bg-gray-900/40 transition-colors"
          >
            <span className="text-3xl md:text-4xl font-black text-orange-500/30 group-hover:text-orange-500/60 shrink-0 w-12 tabular-nums transition-colors">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] md:text-xs text-orange-500/80 uppercase tracking-widest font-semibold">
                {a.category}
              </span>
              <h3 className="text-base md:text-lg font-bold text-white group-hover:text-orange-400 transition-colors mt-1 leading-snug">
                {a.title}
              </h3>
              {a.excerpt && (
                <p className="text-gray-500 text-sm mt-2 line-clamp-2 hidden sm:block">{a.excerpt}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                {a.reading_time_minutes && <span>{a.reading_time_minutes} min read</span>}
                {a.reading_time_minutes && a.published_at && <span className="text-gray-800">·</span>}
                {a.published_at && (
                  <span>{new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                )}
              </div>
            </div>
            {a.image_url ? (
              <div className="relative w-20 h-20 sm:w-28 sm:h-24 rounded-xl overflow-hidden bg-gray-800 shrink-0">
                <Image
                  src={a.image_url}
                  alt={a.title}
                  fill
                  priority={i === 0}
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 80px, 112px"
                />
              </div>
            ) : (
              <div className="w-20 h-20 sm:w-28 sm:h-24 rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/40 flex items-center justify-center shrink-0">
                <span className="text-2xl opacity-40">📝</span>
              </div>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-6 sm:hidden">
        <Link href="/guides" className="inline-block text-sm text-orange-400 hover:text-orange-300 transition-colors font-semibold">
          View all guides →
        </Link>
      </div>
    </section>
  )
}
