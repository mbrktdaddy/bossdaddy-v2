import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import type { WishlistItem } from '@/lib/wishlist'
import { getBuyLabel } from '@/lib/wishlist'
import { StatusBadge } from '@/components/wishlist/StatusBadge'
import { VoteButton } from '@/components/wishlist/VoteButton'
import { SubscribeButton } from '@/components/wishlist/SubscribeButton'
import CommentForm from '@/components/CommentForm'
import CommentList from '@/components/CommentList'
import type { Metadata } from 'next'

export const revalidate = 300

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const admin = createAdminClient()
  const { data } = await admin.from('wishlist_items').select('slug')
  return (data ?? []).map(({ slug }) => ({ slug }))
}

const getWishlistItem = cache(async (slug: string) => {
  const admin = createAdminClient()
  const { data } = await admin
    .from('wishlist_items')
    .select('*, vote_count:wishlist_votes(count)')
    .eq('slug', slug)
    .single()
  return data
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getWishlistItem(slug)
  if (!data) return {}
  return {
    title: `${data.title} — On the Bench`,
    description: data.description ?? `Boss Daddy is considering reviewing ${data.title}. Vote to move it up the queue.`,
    alternates: { canonical: `/bench/${slug}` },
  }
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

  let linkedReviewSlug: string | null = null
  if (wishlistItem.review_id) {
    const { data: linkedReview } = await admin
      .from('reviews')
      .select('slug')
      .eq('id', wishlistItem.review_id)
      .maybeSingle()
    linkedReviewSlug = linkedReview?.slug ?? null
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  let userHasVoted = false
  let userSubscribed = false

  if (user) {
    const [{ data: vote }, { data: sub }] = await Promise.all([
      admin.from('wishlist_votes').select('id').eq('wishlist_item_id', item.id).eq('user_id', user.id).maybeSingle(),
      admin.from('wishlist_subscriptions').select('id').eq('wishlist_item_id', item.id).eq('user_id', user.id).maybeSingle(),
    ])
    userHasVoted = !!vote
    userSubscribed = !!sub
  }

  const isReviewed = wishlistItem.status === 'reviewed'
  const isSkipped  = wishlistItem.status === 'skipped'
  const hasBuyLink = !!wishlistItem.affiliate_url && !!wishlistItem.store

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Breadcrumb */}
      <div className="mb-8 text-xs text-zinc-600">
        <Link href="/bench" className="hover:text-zinc-400 transition-colors">On the Bench</Link>
        <span className="mx-2">→</span>
        <span className="text-zinc-400">{wishlistItem.title}</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-8">
        {wishlistItem.image_url && (
          <div className="relative w-full sm:w-48 h-48 shrink-0 rounded-2xl overflow-hidden bg-zinc-900 shadow-md shadow-black/30">
            <Image
              src={wishlistItem.image_url}
              alt={wishlistItem.title}
              fill
              className="object-contain p-4"
              sizes="192px"
              priority
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <StatusBadge status={wishlistItem.status} className="mb-3" />
          <h1 className="text-2xl sm:text-3xl font-black leading-tight mb-3">{wishlistItem.title}</h1>

          {wishlistItem.description && (
            <p className="text-[var(--bd-text-muted)] text-sm leading-relaxed mb-4">{wishlistItem.description}</p>
          )}

          {isSkipped && wishlistItem.skip_reason && (
            <div className="p-4 bg-zinc-900 rounded-2xl mb-4 shadow-md shadow-black/30">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-1">Why I&apos;m not testing this</p>
              <p className="text-sm text-zinc-400">{wishlistItem.skip_reason}</p>
            </div>
          )}

          {wishlistItem.estimated_review_date && ['queued','testing'].includes(wishlistItem.status) && (
            <p className="text-xs text-zinc-500 mb-4">
              Estimated review: {new Date(wishlistItem.estimated_review_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          )}

          {isReviewed ? (
            <div className="mt-4">
              <Link
                href={linkedReviewSlug ? `/reviews/${linkedReviewSlug}` : '/reviews'}
                className="inline-flex items-center gap-2 px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-2xl transition-colors"
              >
                Read the full review
              </Link>
            </div>
          ) : (
            !isSkipped && (
              <div className="flex flex-wrap gap-3 mt-4">
                <VoteButton
                  itemId={wishlistItem.id}
                  initialVoted={userHasVoted}
                  initialCount={wishlistItem.vote_count as number}
                  isAuthenticated={!!user}
                />
                <SubscribeButton
                  itemId={wishlistItem.id}
                  initialSubscribed={userSubscribed}
                  isAuthenticated={!!user}
                />
                {hasBuyLink && (
                  <a
                    href={`/go/${wishlistItem.slug}`}
                    target="_blank"
                    rel="sponsored nofollow noopener"
                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-2xl transition-colors"
                  >
                    {getBuyLabel(wishlistItem.store, wishlistItem.custom_store_name)}
                  </a>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {!isReviewed && !isSkipped && (
        <div className="mt-8 p-4 bg-orange-950/20 rounded-2xl shadow-md shadow-black/30">
          <p className="text-sm text-orange-300/80">
            <strong className="text-orange-400">{wishlistItem.vote_count as number} {wishlistItem.vote_count === 1 ? 'person has' : 'people have'} voted</strong> for this review.
            The more votes, the sooner it gets done.
            {!user && ' Create a free account to cast your vote.'}
          </p>
        </div>
      )}

      {/* Discussion */}
      {!isSkipped && (
        <div className="mt-12 pt-8 border-t border-gray-800/60">
          <h2 className="text-lg font-black mb-6">What should I test?</h2>
          <div className="mb-8">
            <CommentForm
              contentType="wishlist_item"
              contentId={wishlistItem.id}
              prompt="Everyone seems to love this item. What should I know first?"
            />
          </div>
          <CommentList contentType="wishlist_item" contentId={wishlistItem.id} />
        </div>
      )}

      <div className="mt-8 pt-6">
        <Link href="/bench" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Back to the bench
        </Link>
      </div>
    </div>
  )
}
