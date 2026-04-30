'use server'
import { createClient } from '@/lib/supabase/server'
import type { CategorySlug } from '@/lib/categories'

export type ReviewRow = {
  id: string
  slug: string
  title: string
  product_name: string
  category: string
  rating: number
  excerpt: string | null
  image_url: string | null
  published_at: string | null
}

const PER_PAGE = 12

export async function loadMoreReviews(category: string, page: number): Promise<ReviewRow[]> {
  const from = (page - 1) * PER_PAGE
  const to   = from + PER_PAGE - 1
  const supabase = await createClient()
  const { data } = await supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
    .eq('status', 'approved')
    .eq('is_visible', true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('category', category as any)
    .order('published_at', { ascending: false })
    .range(from, to)
  return (data ?? []) as ReviewRow[]
}
