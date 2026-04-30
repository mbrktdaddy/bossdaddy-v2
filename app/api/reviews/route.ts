import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { resolveProductTokens } from '@/lib/products'
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
  product_slug: z.string().max(80).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { user } = await getUserSafe(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['author', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only authors and admins can create reviews.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const parsed = CreateReviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { title, product_name, category, excerpt, content, rating, pros, cons, disclosure_acknowledged, image_url, product_slug } = parsed.data

    let sanitizedContent: string
    try {
      const { sanitizeHtml } = await import('@/lib/sanitize')
      const resolvedContent = await resolveProductTokens(content, supabase)
      sanitizedContent = sanitizeHtml(resolvedContent)
    } catch (err) {
      console.error('sanitize import/call threw:', err)
      return NextResponse.json({
        error: `Content sanitization failed: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
      }, { status: 500 })
    }

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
        category: category as never, // validated by Zod against CATEGORY_SLUGS
        excerpt: excerpt ?? null,
        content: sanitizedContent,
        image_url: image_url ?? null,
        product_slug: product_slug ?? null,
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
      console.error('Review insert failed:', error)
      if (error.code === '23505') return NextResponse.json({ error: 'A review with this title already exists. Try a slightly different title.' }, { status: 409 })
      return NextResponse.json({
        error: `Failed to create review: ${error.message}`,
        code: error.code,
        details: error.details,
        hint: error.hint,
      }, { status: 500 })
    }
    return NextResponse.json({ review: data }, { status: 201 })
  } catch (err) {
    console.error('Uncaught in POST /api/reviews:', err)
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 })
  }
}
