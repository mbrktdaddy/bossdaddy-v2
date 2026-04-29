import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProductBySlug } from '@/lib/products'

const SLUG_RE = /^[a-z0-9-]+$/

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  if (!SLUG_RE.test(slug)) notFound()

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
