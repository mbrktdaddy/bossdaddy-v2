import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  limit?: number
  className?: string
}

// "Fresh off the Bench" — closes the bench → review loop. Surfaces bench items
// that graduated into a PUBLISHED review, so a reader (or voter) sees the
// pipeline actually delivering: the thing that was on the bench is now tested
// and written up.
//
// Two-step query (graduated items → their published reviews) instead of a
// Supabase FK embed, so it doesn't depend on the auto-generated constraint
// name. No per-user read — safe on statically cached pages.
export default async function OffTheBench({ limit = 3, className = '' }: Props) {
  const admin = createAdminClient()

  // Order newest-updated first and keep the cap high: the reviews query below
  // filters/orders by published_at, so every reviewed product's metadata must be
  // present in this map or a recent review would silently drop off the rail.
  // Reviewed gear in the spine links to its published review via
  // reviews.product_slug (catalog products don't carry products.review_id).
  const { data: grad } = await admin
    .from('products')
    .select('slug, name, image_url')
    .eq('status', 'reviewed')
    .order('updated_at', { ascending: false })
    .limit(500)

  if (!grad || grad.length === 0) return null

  const slugs = grad.map((g) => g.slug)
  const { data: reviews } = await admin
    .from('reviews')
    .select('id, slug, title, image_url, published_at, product_slug')
    .in('product_slug', slugs)
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (!reviews || reviews.length === 0) return null

  const productBySlug = new Map(grad.map((g) => [g.slug, g]))
  const items = reviews.map((r) => {
    const product = r.product_slug ? productBySlug.get(r.product_slug) : undefined
    return {
      reviewSlug: r.slug,
      image: product?.image_url ?? r.image_url ?? null,
      benchTitle: product?.name ?? r.title,
    }
  })

  return (
    <section className={className}>
      <div className="mb-5">
        <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
        <h2 className="text-lg font-black inline-flex items-center gap-2 text-prose">
          <svg className="w-4 h-4 shrink-0 text-accent-text-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Fresh off the Bench
        </h2>
        <p className="text-xs text-prose-muted mt-0.5">
          Was on the bench. Now tested and fully reviewed.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map((item) => (
          <Link
            key={item.reviewSlug}
            href={`/reviews/${item.reviewSlug}`}
            className="group flex items-center gap-3 sm:flex-col sm:items-stretch bg-surface border border-soft rounded-xl overflow-hidden shadow-md shadow-black/5 hover:border-accent-border/40 hover:shadow-lg hover:shadow-black/10 hover:-translate-y-1 transition-all"
          >
            <div className="relative shrink-0 w-20 h-20 sm:w-full sm:h-auto sm:aspect-[4/3] bg-surface-sunken">
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.benchTitle}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 80px, 33vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-accent-text/30">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              <span className="absolute top-2 left-2 inline-flex items-center bg-surface-sunken/85 backdrop-blur border border-soft rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent-text-soft">
                Reviewed
              </span>
            </div>
            <div className="py-3 pr-3 sm:p-4 flex-1 min-w-0">
              <p className="text-sm font-bold text-prose group-hover:text-accent-text-soft transition-colors leading-snug line-clamp-2">
                {item.benchTitle}
              </p>
              <p className="mt-2 text-[10px] text-prose-faint uppercase tracking-widest font-semibold group-hover:text-accent-text-soft transition-colors">
                Read the review →
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
