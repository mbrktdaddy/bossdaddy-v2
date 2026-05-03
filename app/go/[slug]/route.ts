import { redirect, notFound } from 'next/navigation'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProductBySlug } from '@/lib/products'
import { checkRateLimit } from '@/lib/rate-limit'

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

  if (product) {
    const destination = product.affiliate_url ?? product.non_affiliate_url
    if (!destination) notFound()
    redirect(destination)
  }

  // Fall through to wishlist items
  const admin = createAdminClient()
  const { data: wishlistItem } = await admin
    .from('wishlist_items')
    .select('affiliate_url')
    .eq('slug', slug)
    .maybeSingle()

  if (!wishlistItem?.affiliate_url) notFound()

  redirect(wishlistItem.affiliate_url)
}
