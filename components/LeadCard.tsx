import Link from 'next/link'
import Image from 'next/image'

interface Props {
  href: string
  title: string
  imageUrl: string | null
  /** Role kicker — the category label. Never a repeat of the title. */
  eyebrow: string
  /** Optional image-overlay pill ("Newest"). Max one per card; the Cover Story
   *  already owns "Editor's Pick", so keep these distinct. */
  badge?: string
  excerpt?: string | null
  /** Footer right-hand detail — a date, or "8 min read". */
  meta?: string | null
  cta: string
  /**
   * Which surface this card sits ON, which decides the card's own background.
   * Getting this wrong is the classic dark-canvas bug: a `bg-surface` card inside
   * a `bg-surface` section is invisible except for its border.
   */
  on?: 'background' | 'surface'
  sizes?: string
}

/**
 * The lead half of a "Template A" module — one image-forward card paired with a
 * stack of compact rows in the adjacent column. Shared by Just Dropped (reviews)
 * and the Library's topic blocks (guides) so the two modules are the same object
 * at a glance; that sameness is what makes the page's alternating rhythm read as
 * a system rather than as improvisation.
 *
 * Elevation is border + hover lift, never shadow — black shadows are invisible on
 * a near-black canvas (brand-guide §2).
 */
export default function LeadCard({
  href, title, imageUrl, eyebrow, badge, excerpt, meta, cta,
  on = 'background', sizes = '(max-width: 1024px) 100vw, 560px',
}: Props) {
  return (
    <Link
      href={href}
      className={`group flex flex-col border border-soft rounded-2xl overflow-hidden hover:border-accent hover:-translate-y-0.5 transition-all duration-200 ${
        on === 'surface' ? 'bg-background' : 'bg-surface'
      }`}
    >
      <div className="relative aspect-[16/10] bg-surface-raised shrink-0">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes={sizes}
            className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        )}
        {badge && (
          <span className="absolute top-4 left-4 bg-accent text-white text-[10px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <div className="p-6 sm:p-7 flex flex-col flex-1">
        <div className="inline-flex items-center gap-1.5 mb-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="text-[10px] font-extrabold text-accent uppercase tracking-[0.16em]">
            {eyebrow}
          </span>
        </div>
        <h3 className="font-editorial-display font-semibold text-prose text-2xl leading-[1.15] tracking-tight group-hover:text-accent transition-colors">
          {title}
        </h3>
        {excerpt && (
          <p className="text-sm text-prose-muted leading-[1.7] mt-3 line-clamp-3">
            {excerpt}
          </p>
        )}
        <div className="flex items-center justify-between gap-4 mt-5 pt-4 border-t border-soft">
          <span className="text-sm font-semibold text-accent inline-flex items-center gap-1">
            {cta}
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
          {meta && <span className="text-[11px] text-prose-faint shrink-0">{meta}</span>}
        </div>
      </div>
    </Link>
  )
}
