import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug } from '@/lib/categories'
import type { GuideRow } from '@/app/(public)/guides/actions'

export default function FeaturedGuideCard({ guide: g }: { guide: GuideRow }) {
  const cat = getCategoryBySlug(g.category)

  return (
    <Link
      href={`/guides/${g.slug}`}
      className="group relative flex flex-col sm:flex-row overflow-hidden rounded-2xl bg-gray-900 shadow-xl shadow-black/50 hover:shadow-2xl hover:shadow-black/60 transition-all duration-300 mt-2 mb-20"
    >
      {/* Image */}
      <div className="relative w-full sm:w-[55%] h-56 sm:h-auto shrink-0 bg-gray-800">
        {g.image_url ? (
          <Image
            src={g.image_url}
            alt={g.title}
            fill
            priority
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, 55vw"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${cat?.color ?? 'from-gray-800 to-gray-900'} flex items-center justify-center`}>
            <span className="text-6xl opacity-30">{cat?.icon ?? '📖'}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-gray-900 to-transparent sm:hidden" />
      </div>

      {/* Content */}
      <div className="flex flex-col justify-between p-6 sm:p-8 flex-1 min-w-0">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 bg-orange-950/60 px-2.5 py-1 rounded-full">
              Featured Guide
            </span>
            {cat && (
              <span className="text-[10px] text-gray-500 uppercase tracking-widest">{cat.icon} {cat.label}</span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-black leading-snug text-white group-hover:text-orange-400 transition-colors mb-3">
            {g.title}
          </h2>
          {g.excerpt && (
            <p className="text-gray-400 text-sm leading-relaxed line-clamp-3">{g.excerpt}</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-800/60">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {g.reading_time_minutes && (
              <span>{g.reading_time_minutes} min read</span>
            )}
            {g.published_at && (
              <span>{new Date(g.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            )}
          </div>
          <span className="text-sm font-semibold text-orange-500 group-hover:text-orange-400 transition-colors">
            Read guide →
          </span>
        </div>
      </div>
    </Link>
  )
}
