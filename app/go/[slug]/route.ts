import { redirect, notFound } from 'next/navigation'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProductBySlug } from '@/lib/products'
import { checkRateLimit } from '@/lib/rate-limit'
import { appendAmazonTag } from '@/lib/amazon-tag'

const SLUG_RE = /^[a-z0-9-]+$/

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  if (!SLUG_RE.test(slug)) notFound()

  // Rate-limit per-IP to protect associate account integrity. Affiliate
  // networks (Amazon, etc.) flag accounts whose click traffic shows bot
  // patterns — we'd rather refuse the redirect than have those clicks
  // counted against us. 30/min/IP is generous for real humans, fatal to bots.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
  const { success } = await checkRateLimit(`click:${ip}`, 'click')
  if (!success) {
    return new NextResponse('Too many redirects. Slow down.', {
      status: 429,
      headers: { 'Retry-After': '60' },
    })
  }

  const supabase = await createClient()
  const product = await getProductBySlug(supabase, slug)

  const tag = process.env.AMAZON_ASSOCIATE_TAG ?? ''

  if (product) {
    const raw = product.affiliate_url ?? product.non_affiliate_url
    if (!raw) notFound()
    redirect(appendAmazonTag(raw, tag))
  }

  const admin = createAdminClient()

  // Fall through to a researched candidate (gear_candidates) — picks surfaced by
  // The Boss carry a tracked link before they're ever adopted into the catalog.
  const { data: candidate } = await admin
    .from('gear_candidates')
    .select('affiliate_url')
    .eq('slug', slug)
    .maybeSingle()

  if (!candidate?.affiliate_url) notFound()

  redirect(appendAmazonTag(candidate.affiliate_url, tag))
}
