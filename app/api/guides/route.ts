import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { computeReadingTime } from '@/lib/reading-time'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { resolveProductTokens } from '@/lib/products'
import { CATEGORY_SLUGS } from '@/lib/categories'
import { z } from 'zod'

const CategorySchema = z.enum(CATEGORY_SLUGS as [string, ...string[]])

const CreateGuideSchema = z.object({
  title: z.string().min(10).max(120),
  category: CategorySchema,
  excerpt: z.string().max(200).optional(),
  content: z.string().min(100),
  image_url: z.string().url().optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { user } = await getUserSafe(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Role check — only authors and admins can create guides
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['author', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only authors and admins can create guides.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const parsed = CreateGuideSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { title, category, excerpt, content, image_url } = parsed.data

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

    const slug =
      title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) +
      '-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8)

    const { data, error } = await supabase
      .from('guides')
      .insert({
        author_id: user.id,
        slug,
        title,
        category,
        excerpt: excerpt ?? null,
        content: sanitizedContent,
        image_url: image_url ?? null,
        reading_time_minutes: computeReadingTime(sanitizedContent),
        has_affiliate_links: detectAffiliateLinks(sanitizedContent),
        status: 'draft',
      })
      .select()
      .single()

    if (error) {
      console.error('Article insert failed:', error)
      if (error.code === '23505') return NextResponse.json({ error: 'A guide with this title already exists. Try a slightly different title.' }, { status: 409 })
      return NextResponse.json({
        error: `Failed to create guide: ${error.message}`,
        code: error.code,
        details: error.details,
        hint: error.hint,
      }, { status: 500 })
    }
    return NextResponse.json({ article: data }, { status: 201 })
  } catch (err) {
    console.error('Uncaught in POST /api/guides:', err)
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 })
  }
}
