import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { resolveProductTokens } from '@/lib/products'
import { computeReadingTime } from '@/lib/reading-time'
import { CreateReviewSchema } from '@/lib/reviews/schema'

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

    const { title, product_name, category, excerpt, content, pros, cons, disclosure_acknowledged, image_url, product_slug, comparison_product_slugs, tldr, key_takeaways, best_for, not_for, faqs, testing_duration, testing_since, testing_note, how_you_used_it, standout_moment, price_paid_cents, score_quality, score_value, score_ease, score_daily_use, would_rebuy, suggested_tags } = parsed.data

    // Don't let a product compare against itself; keep slugs distinct.
    const comparisonSlugs = [...new Set(comparison_product_slugs.filter((s) => s && s !== product_slug))]

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

    const { generateUniqueSlug } = await import('@/lib/slug')
    const slug = await generateUniqueSlug(supabase, 'reviews', title)

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
        product_slug: product_slug ?? null,
        comparison_product_slugs: comparisonSlugs,
        pros,
        cons,
        tldr: tldr ?? null,
        key_takeaways,
        best_for,
        not_for,
        faqs,
        has_affiliate_links: hasAffiliateLinks,
        disclosure_acknowledged,
        reading_time_minutes: computeReadingTime(sanitizedContent),
        testing_duration: testing_duration ?? null,
        testing_since: testing_since ?? null,
        testing_note: testing_note ?? null,
        how_you_used_it: how_you_used_it ?? null,
        standout_moment: standout_moment ?? null,
        price_paid_cents: price_paid_cents ?? null,
        score_quality:    score_quality   ?? null,
        score_value:      score_value     ?? null,
        score_ease:       score_ease      ?? null,
        score_daily_use:  score_daily_use ?? null,
        would_rebuy:      would_rebuy     ?? null,
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

    // Auto-apply AI-suggested tags — fire-and-forget, don't block response
    if (data && suggested_tags.length > 0) {
      const tagRows = suggested_tags.map((slug) => ({ review_id: data.id, tag_slug: slug }))
      supabase.from('review_tags').insert(tagRows).then(({ error: tagErr }) => {
        if (tagErr) console.error('Auto-tag insert failed:', tagErr)
      })
    }

    return NextResponse.json({ review: data }, { status: 201 })
  } catch (err) {
    console.error('Uncaught in POST /api/reviews:', err)
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 })
  }
}
