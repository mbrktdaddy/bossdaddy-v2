import Link from 'next/link'
import Image from 'next/image'

interface Props {
  href: string
  title: string
  imageUrl: string | null
  /** Role kicker — the category label. Never a repeat of the title. */
  eyebrow: string
  /** Optional image-overlay tag ("Newest"). Max one per card, and it is the
   *  only mark the image carries — no second badge, no sticker beside it. */
  badge?: string
  excerpt?: string | null
  /** Footer right-hand detail — a date, or "8 min read". */
  meta?: string | null
  cta: string
  /**
   * Which surface this card sits ON, which decides the card's own background.
   * On the light canvas both resolve to white and nothing shows; inside a dark
   * zone the card reads as a soft panel one step off its section.
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
 * BORDERLESS on purpose (light-editorial pass, 2026-10-08). On a white canvas a
 * 1px grey box around every card is the whole "component library" feeling; the
 * publications this site is measured against (Wirecutter, Strategist, Gear
 * Patrol) let the image and the type carry the card and use hairline rules only
 * between rows. The copy sits flush with the image's left edge, and the single
 * hairline above the footer is the one rule the card keeps. Don't re-add the box.
 */
export default function LeadCard({
  href, title, imageUrl, eyebrow, badge, excerpt, meta, cta,
  on = 'background', sizes = '(max-width: 1024px) 100vw, 560px',
}: Props) {
  return (
    <Link
      href={href}
      className={`group flex flex-col hover:-translate-y-0.5 transition-transform duration-200 ${
        on === 'surface' ? 'bg-background' : 'bg-surface'
      }`}
    >
      <div className="relative aspect-[16/10] bg-surface-raised shrink-0 rounded-xl overflow-hidden">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt="" /* decorative: the link's text already names it — an alt here gets read twice */
            fill
            sizes={sizes}
            className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        )}
        {badge && (
          /* A small square tag, not a pill: pills over photos are the SaaS tell. */
          <span className="absolute top-3 left-3 bg-chrome text-white text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-sm">
            {badge}
          </span>
        )}
      </div>
      <div className="pt-5 flex flex-col flex-1">
        <div className="inline-flex items-center gap-1.5 mb-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="text-[10px] font-extrabold text-eyebrow uppercase tracking-[0.16em]">
            {eyebrow}
          </span>
        </div>
        <h3 className="font-black text-prose text-2xl leading-[1.1] tracking-tight group-hover:text-accent transition-colors">
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
