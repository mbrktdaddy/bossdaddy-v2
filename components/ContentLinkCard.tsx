import Link from 'next/link'
import Image from 'next/image'
import { createAnonClient } from '@/lib/supabase/anon'
import RatingScore from '@/components/RatingScore'

interface Props {
  contentType: 'review' | 'guide'
  slug: string
}

interface TargetRow {
  slug: string
  title: string
  excerpt: string | null
  image_url: string | null
  product_name?: string | null
  rating?: number | null
}

/**
 * Async server component rendered inline inside guide/review bodies. Triggered
 * by the `<div class="bd-content-link" data-content-type data-content-slug>`
 * marker — the post-sanitize form of a `[[REVIEW:slug]]` / `[[GUIDE:slug]]`
 * editor token. Renders a compact "read next" cross-link card that keeps the
 * flywheel turning between articles and reviews.
 */
export default async function ContentLinkCard({ contentType, slug }: Props) {
  // Cookie-free anon client — public review/guide lookup (audit H3).
  const supabase = createAnonClient()
  const isReview = contentType === 'review'

  const { data } = await supabase
    .from(isReview ? 'reviews' : 'guides')
    .select(
      isReview
        ? 'slug, title, excerpt, image_url, product_name, rating'
        : 'slug, title, excerpt, image_url',
    )
    .eq('slug', slug)
    .eq('status', 'approved')
    .eq('is_visible', true)
    .single()

  if (!data) return null
  const t = data as unknown as TargetRow

  const href = `${isReview ? '/reviews' : '/guides'}/${t.slug}`
  const eyebrow = isReview ? 'Read the Review' : 'Read the Guide'

  return (
    <aside
      className="not-prose my-8 bg-surface border border-soft hover:border-accent-border/40 rounded-xl overflow-hidden transition-colors shadow-lg shadow-black/5"
      aria-label={`${eyebrow}: ${t.title}`}
    >
      <Link href={href} className="group flex items-stretch gap-4">
        {t.image_url && (
          <div className="relative w-24 sm:w-32 shrink-0 bg-surface-sunken self-stretch">
            <Image src={t.image_url} alt={t.product_name || t.title} fill className="object-cover" sizes="128px" />
          </div>
        )}
        <div className="flex-1 min-w-0 py-4 pr-4 sm:py-5">
          <p className="text-[10px] sm:text-xs text-accent-text-soft uppercase tracking-[0.2em] font-black mb-1.5">
            {eyebrow}
          </p>
          <h3 className="text-base sm:text-lg font-black text-prose leading-snug group-hover:text-accent-text-soft transition-colors line-clamp-2">
            {t.title}
          </h3>
          {isReview && typeof t.rating === 'number' && t.rating > 0 && (
            <div className="mt-1.5">
              <RatingScore rating={t.rating} size="sm" />
            </div>
          )}
          {t.excerpt && (
            <p className="mt-1.5 text-sm text-prose-muted leading-relaxed line-clamp-2">{t.excerpt}</p>
          )}
        </div>
      </Link>
    </aside>
  )
}
