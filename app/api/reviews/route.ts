import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeHtml } from '@/lib/sanitize'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { z } from 'zod'

const CreateReviewSchema = z.object({
  title: z.string().min(10).max(120),
  product_name: z.string().min(2).max(120),
  content: z.string().min(100),
  rating: z.number().int().min(1).max(5),
  disclosure_acknowledged: z.boolean(),
})

// POST /api/reviews — create a new review (draft)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = CreateReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { title, product_name, content, rating, disclosure_acknowledged } = parsed.data
  const sanitizedContent = sanitizeHtml(content)
  const hasAffiliateLinks = detectAffiliateLinks(sanitizedContent)

  if (hasAffiliateLinks && !disclosure_acknowledged) {
    return NextResponse.json(
      { error: 'Affiliate links detected. You must acknowledge the disclosure before submitting.' },
      { status: 422 }
    )
  }

  // Generate slug
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) +
    '-' +
    Math.random().toString(36).slice(2, 7)

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      author_id: user.id,
      slug,
      title,
      product_name,
      content: sanitizedContent,
      rating,
      has_affiliate_links: hasAffiliateLinks,
      disclosure_acknowledged,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ review: data }, { status: 201 })
}
