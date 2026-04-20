import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug } from '@/lib/categories'
import ReviewCard from '@/app/(public)/reviews/_components/ReviewCard'
import type { ReviewRow } from '@/app/(public)/reviews/actions'
import type { Metadata } from 'next'

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) return { title: 'Category Not Found' }
  return {
    title: `${cat.label} Reviews`,
    description: cat.description,
  }
}


export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) notFound()

  const supabase = await createClient()
  const { data } = await supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .eq('category', slug)
    .order('published_at', { ascending: false })

  const reviews = (data ?? []) as ReviewRow[]

  return (
    <>
      {/* Category hero */}
      <div className={`bg-gradient-to-br ${cat.color} border-b border-gray-800/60`}>
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="text-5xl mb-4">{cat.icon}</div>
          <h1 className={`text-4xl font-black mb-3 ${cat.accent}`}>{cat.label}</h1>
          <p className="text-gray-400 text-lg max-w-xl">{cat.description}</p>
          <p className="text-sm text-gray-600 mt-3">
            {reviews.length ?? 0} {reviews.length === 1 ? 'review' : 'reviews'}
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/reviews" className="text-sm text-gray-500 hover:text-white transition-colors">← All Reviews</Link>
        </div>

        {!reviews.length ? (
          <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
            <p className="text-gray-600 text-lg">No {cat.label} reviews yet.</p>
            <p className="text-gray-700 text-sm mt-2">Gear is being tested. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
          </div>
        )}
      </main>
    </>
  )
}
