'use server'
import { createClient } from '@/lib/supabase/server'

export type GuideRow = {
  id: string
  slug: string
  title: string
  category: string
  excerpt: string | null
  image_url: string | null
  published_at: string | null
  reading_time_minutes: number | null
}

const PER_PAGE = 12

export async function loadMoreGuides(category: string, page: number): Promise<GuideRow[]> {
  const from = (page - 1) * PER_PAGE
  const to   = from + PER_PAGE - 1
  const supabase = await createClient()
  const { data } = await supabase
    .from('guides')
    .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .eq('category', category)
    .order('published_at', { ascending: false })
    .range(from, to)
  return (data ?? []) as GuideRow[]
}
