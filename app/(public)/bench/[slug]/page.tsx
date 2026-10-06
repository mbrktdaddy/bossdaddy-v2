import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FtcDisclosure from '@/components/FtcDisclosure'
import { createAdminClient } from '@/lib/supabase/admin'
import type { WishlistItem } from '@/lib/wishlist'
import { getBuyLabel, requestedByLabel } from '@/lib/wishlist'
import { StatusBadge } from '@/components/wishlist/StatusBadge'
import { SubscribeButton } from '@/components/wishlist/SubscribeButton'
import { TestingLog } from '@/components/products/TestingLog'
import CommentForm from '@/components/CommentForm'
import CommentList from '@/components/CommentList'
import { BenchGallery } from '@/components/BenchGallery'
import BenchStrip from '@/components/BenchStrip'
import { buildSocialMetadata, toAbsoluteUrl } from '@/lib/og'
import type { Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { buttonVariants } from '@/components/ui/Button'
import { productClaims, type ProductAcquisition, type ProductStatus } from '@/lib/products'
import { withWeeks, type TestingNote } from '@/lib/products/testing-notes'

// The stages that have a Bench page. Catalog, Radar and Archived products are
// not on the Bench, so their slugs 404 here rather than render a stray page.
const BENCH_PAGE_STATUSES = ['queued', 'testing', 'reviewed', 'passed']

// The Bench's one job is follow: votes are cast on the Radar, and the ones that
// carried over show as "Requested by N dads". Per-user follow state is fetched
// CLIENT-side by SubscribeButton (same pattern as LikeButton + the comment widgets), so this
// server render does no per-user cookie read of its own. The route still
// renders dynamically (ƒ) like reviews/guides because the shared CommentList
// reads the session — that's expected and fine. Do NOT reintroduce a
// server-side per-user read (getUserSafe/createClient) here: that, combined
// with generateStaticParams, is what crashed the prerender (DYNAMIC_SERVER_USAGE).
export const revalidate = 300

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('products')
    .select('slug')
    .in('status', BENCH_PAGE_STATUSES)
  return (data ?? []).map(({ slug }) => ({ slug }))
}

const getWishlistItem = cache(async (slug: string) => {
  const admin = createAdminClient()
  const { data } = await admin
    .from('products')
    .select('*, title:name, vote_count:wishlist_votes(count)')
    .eq('slug', slug)
    .in('status', BENCH_PAGE_STATUSES)
    .maybeSingle()
  return data
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getWishlistItem(slug)
  if (!data) return { robots: { index: false, follow: true } }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const meta = buildSocialMetadata({
    title: `${data.title} — On the Bench`,
    description: data.description ?? `${data.title} is on the Boss Daddy Bench, lined up for a real-world test.`,
    path: `/bench/${slug}`,
    siteUrl,
    type: 'site',
    cta: 'Follow the test',
    heroUrl: toAbsoluteUrl(data.image_url as string | null, siteUrl),
  })
  // Bench items stay out of search (noindex) but still get a rich share preview.
  return { ...meta, robots: { index: false, follow: true } }
}

export default async function BenchDetailPage({ params }: Props) {
  const { slug } = await params
  const item = await getWishlistItem(slug)

  if (!item) notFound()

  const admin = createAdminClient()

  const wishlistItem = {
    ...(item as unknown as WishlistItem),
    vote_count: (item.vote_count as { count: number }[])?.[0]?.count ?? 0,
  }

  const [{ data: linkedReview }, { data: noteRows }] = await Promise.all([
    wishlistItem.review_id
      ? admin.from('reviews').select('slug').eq('id', wishlistItem.review_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('product_testing_notes')
      .select('*')
      .eq('product_id', wishlistItem.id)
      .order('noted_on', { ascending: false })
      .order('created_at', { ascending: false }),
  ])
  const linkedReviewSlug = (linkedReview as { slug: string } | null)?.slug ?? null
  const notes = withWeeks((noteRows ?? []) as TestingNote[])

  // Only claims the operator set (brand-guide §1.9): "Bought it", and the legal
  // disclosure for a provided or loaned unit.
  const claims = productClaims({
    status:      item.status as ProductStatus,
    acquisition: item.acquisition as ProductAcquisition | null,
    provided_by: item.provided_by as string | null,
    brand:       item.brand as string | null,
  })

  const isReviewed = wishlistItem.status === 'reviewed'
  const isSkipped  = wishlistItem.status === 'passed'
  const hasBuyLink = !!wishlistItem.affiliate_url && !!wishlistItem.store
  const voteCount  = wishlistItem.vote_count as number

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Breadcrumb */}
      <div className="mb-8 text-xs text-prose-faint">
        <Link href="/bench" className="hover:text-prose-muted transition-colors">On the Bench</Link>
        <span className="mx-2">→</span>
        <span className="text-prose-muted">{wishlistItem.title}</span>
      </div>

      {hasBuyLink && <FtcDisclosure />}

      <BenchGallery
        images={[wishlistItem.image_url, ...(wishlistItem.gallery_images ?? [])].filter(Boolean) as string[]}
        alt={wishlistItem.title}
      />

      <div className="flex flex-col gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <StatusBadge status={wishlistItem.status} />
            {claims.bought && <Badge tone="neutral">Bought it</Badge>}
            {voteCount > 0 && (
              <span className="text-xs text-prose-faint tabular-nums">{requestedByLabel(voteCount)}</span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black leading-tight mb-3">{wishlistItem.title}</h1>

          {claims.disclosure && (
            <p className="text-xs text-prose-faint italic mb-4">{claims.disclosure}</p>
          )}

          {wishlistItem.description && (
            <p className="text-prose-muted text-sm leading-relaxed mb-4">{wishlistItem.description}</p>
          )}

          {isSkipped && wishlistItem.skip_reason && (
            <Card tone="raised" className="p-4 mb-4">
              <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
              <p className="text-xs font-black uppercase tracking-widest text-prose-muted mb-1">Why I&apos;m not testing this</p>
              <p className="text-sm text-prose-muted">{wishlistItem.skip_reason}</p>
            </Card>
          )}

          {wishlistItem.estimated_review_date && ['queued','testing'].includes(wishlistItem.status) && (
            <p className="text-xs text-prose-faint mb-4">
              Estimated review: {new Date(wishlistItem.estimated_review_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          )}

          {isReviewed ? (
            <div className="mt-4">
              <Link
                href={linkedReviewSlug ? `/reviews/${linkedReviewSlug}` : '/reviews'}
                className={buttonVariants()}
              >
                Read the full review
              </Link>
            </div>
          ) : (
            !isSkipped && (
              <div className="flex flex-wrap gap-3 mt-4">
                <SubscribeButton itemId={wishlistItem.id} />
                {hasBuyLink && (
                  <a
                    href={`/go/${wishlistItem.slug}`}
                    target="_blank"
                    rel="sponsored nofollow noopener"
                    className={buttonVariants()}
                  >
                    {getBuyLabel(wishlistItem.store, wishlistItem.custom_store_name)}
                  </a>
                )}
              </div>
            )
          )}
        </div>
      </div>

      <TestingLog notes={notes} className="mt-10" />

      {/* Discussion */}
      {!isSkipped && (
        <div className="mt-12 pt-8 border-t border-soft">
          <h2 className="text-lg font-black mb-6">Are you familiar with this product?</h2>
          <div className="mb-8">
            <CommentForm
              contentType="product"
              contentId={wishlistItem.id}
              prompt="Everyone seems to love this item. What should I know first?"
            />
          </div>
          <CommentList contentType="product" contentId={wishlistItem.id} />
        </div>
      )}

      <div className="mt-8 pt-6">
        <Link href="/bench" className="text-sm text-prose-faint hover:text-prose-muted transition-colors">
          ← On the Bench
        </Link>
      </div>

      <div className="mt-12">
        <BenchStrip ctaText="See more on the bench" />
      </div>
    </div>
  )
}
