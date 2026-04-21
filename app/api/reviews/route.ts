import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeHtml } from '@/lib/sanitize'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { computeReadingTime } from '@/lib/reading-time'
import { CATEGORY_SLUGS } from '@/lib/categories'
import { z } from 'zod'

const CategorySchema = z.enum(CATEGORY_SLUGS as [string, ...string[]])

const CreateReviewSchema = z.object({
  title: z.string().min(10).max(120),
  product_name: z.string().min(2).max(120),
  category: CategorySchema,
  excerpt: z.string().max(200).optional(),
  content: z.string().min(100),
  rating: z.number().min(1).max(10),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  disclosure_acknowledged: z.boolean(),
  image_url: z.string().url().optional().nullable(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Role check — only authors and admins can create reviews
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['author', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only authors and admins can create reviews.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = CreateReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { title, product_name, category, excerpt, content, rating, pros, cons, disclosure_acknowledged, image_url } = parsed.data
  const sanitizedContent = sanitizeHtml(content)
  const hasAffiliateLinks = detectAffiliateLinks(sanitizedContent)

  if (hasAffiliateLinks && !disclosure_acknowledged) {
    return NextResponse.json(
      { error: 'Affiliate links detected. You must acknowledge the disclosure before submitting.' },
      { status: 422 }
    )
  }

  const slug =
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) +
    '-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8)

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      author_id: user.id,
      slug,
      title,
      product_name,
      category,
      excerpt: excerpt ?? null,
      content: sanitizedContent,
      image_url: image_url ?? null,
      rating,
      pros,
      cons,
      has_affiliate_links: hasAffiliateLinks,
      disclosure_acknowledged,
      reading_time_minutes: computeReadingTime(sanitizedContent),
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A review with this title already exists. Try a slightly different title.' }, { status: 409 })
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 })
  }
  return NextResponse.json({ review: data }, { status: 201 })
}
