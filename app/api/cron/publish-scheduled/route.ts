import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

// Secured by Vercel Cron secret. Hit manually with ?secret=... for testing.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const qSecret = new URL(request.url).searchParams.get('secret')

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically
  const isVercelCron = secret && authHeader === `Bearer ${secret}`
  const isManual     = secret && qSecret === secret

  if (secret && !isVercelCron && !isManual) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Find items whose scheduled time has arrived and are not yet live
  const [{ data: dueArticles }, { data: dueReviews }] = await Promise.all([
    admin
      .from('articles')
      .select('id, slug')
      .not('scheduled_publish_at', 'is', null)
      .lte('scheduled_publish_at', now)
      .in('status', ['draft', 'pending', 'rejected']),
    admin
      .from('reviews')
      .select('id, slug')
      .not('scheduled_publish_at', 'is', null)
      .lte('scheduled_publish_at', now)
      .in('status', ['draft', 'pending', 'rejected']),
  ])

  const articleIds = (dueArticles ?? []).map((a) => a.id)
  const reviewIds  = (dueReviews ?? []).map((r) => r.id)

  let articlesPublished = 0
  let reviewsPublished  = 0

  if (articleIds.length) {
    const { error, count } = await admin
      .from('articles')
      .update({
        status:               'approved',
        published_at:         now,
        scheduled_publish_at: null,
      }, { count: 'exact' })
      .in('id', articleIds)
    if (error) console.error('Scheduled article publish failed:', error)
    articlesPublished = count ?? 0
  }

  if (reviewIds.length) {
    const { error, count } = await admin
      .from('reviews')
      .update({
        status:               'approved',
        published_at:         now,
        scheduled_publish_at: null,
      }, { count: 'exact' })
      .in('id', reviewIds)
    if (error) console.error('Scheduled review publish failed:', error)
    reviewsPublished = count ?? 0
  }

  // Revalidate public pages that might have changed
  if (articlesPublished > 0) {
    revalidatePath('/')
    revalidatePath('/articles')
    ;(dueArticles ?? []).forEach((a) => a.slug && revalidatePath(`/articles/${a.slug}`))
  }
  if (reviewsPublished > 0) {
    revalidatePath('/')
    revalidatePath('/reviews')
    ;(dueReviews ?? []).forEach((r) => r.slug && revalidatePath(`/reviews/${r.slug}`))
  }

  return NextResponse.json({
    success: true,
    articlesPublished,
    reviewsPublished,
    checkedAt: now,
  })
}
