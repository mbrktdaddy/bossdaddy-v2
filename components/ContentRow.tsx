import Link from 'next/link'
import Image from 'next/image'
import RatingScore from '@/components/RatingScore'

interface Props {
  href: string
  /** Role kicker — the category label. Never a repeat of the headline. */
  eyebrow: string
  headline: string
  /** Small line under the headline. `/reviews` puts the product name here, where
   *  the headline is the review's own title. */
  sub?: string | null
  excerpt?: string | null
  /** Footer detail — a date, or "8 min read". */
  meta?: string | null
  imageUrl: string | null
  imageAlt: string
  /** Renders a RatingScore when supplied. Omit on recency surfaces: "Just dropped"
   *  is a date, not a verdict. */
  rating?: number | null
  isLast?: boolean
  /**
   * Mirrors the row — thumbnail left, text right — from `lg` up.
   *
   * Set by TopicBlock on its odd-numbered (lead-right) blocks, and only correct for
   * rows in a LEFT-hand column. Unmirrored rows in a left column push their
   * thumbnails into the page's middle gutter, hard against the lead card, which
   * reads busier than the repetition the alternation exists to relieve — so the row
   * must mirror whenever its module does. Below `lg` the module is one column and
   * this does nothing, deliberately: DOM order stays text-then-thumb on mobile.
   */
  flip?: boolean
}

/**
 * The compact directory row — one component for every per-category list on the
 * site: the homepage Library's topic blocks, `/guides`, and `/reviews`.
 *
 * Replaced four near-identical rows (`components/GuideRow`, `components/ReviewRow`,
 * `/guides`'s local `GuideRowItem`, `/reviews`'s local `ReviewRow`) that had drifted
 * into two different geometries — two put the image left, two put it right — so the
 * same directory pattern looked like two different patterns depending on the URL.
 *
 * Geometry: text left, thumbnail right. That's the editorial lane. `/gear` keeps its
 * own image-left rows on purpose (see brand-guide §2 "two lanes" — /gear is
 * deliberately utility-styled), so don't convert it to this.
 *
 * Props are caller-normalized rather than typed per content kind. Guides and reviews
 * disagree about which field is the headline, so a `guide | review` union would just
 * push that decision in here where it doesn't belong.
 */
export default function ContentRow({
  href, eyebrow, headline, sub, excerpt, meta, imageUrl, imageAlt, rating, isLast, flip,
}: Props) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 sm:gap-5 py-5 ${flip ? 'lg:flex-row-reverse' : ''} ${isLast ? '' : 'border-b border-soft'}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-accent uppercase tracking-[0.16em] mb-1.5">
          {eyebrow}
        </p>
        <h3 className="text-base sm:text-lg font-extrabold text-prose leading-snug mb-1.5 group-hover:text-accent transition-colors">
          {headline}
        </h3>
        {sub && <p className="text-xs text-prose-faint mb-1.5 truncate">{sub}</p>}
        {excerpt && (
          <p className="text-sm text-prose-muted leading-relaxed line-clamp-2 mb-2 hidden sm:block">
            {excerpt}
          </p>
        )}
        {(meta || rating != null) && (
          <div className="flex items-center gap-3 text-[11px] text-prose-faint">
            {rating != null && <RatingScore rating={rating} />}
            {meta && <span>{meta}</span>}
          </div>
        )}
      </div>
      <div className="shrink-0 w-20 h-16 sm:w-28 sm:h-20 rounded-xl overflow-hidden bg-surface-raised border border-soft">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt}
            width={112}
            height={80}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-prose-faint/40">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 6h.008v.008H18V6zm2.25 12H3.75A1.5 1.5 0 012.25 16.5v-9A1.5 1.5 0 013.75 6h16.5a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5z" />
            </svg>
          </div>
        )}
      </div>
    </Link>
  )
}
