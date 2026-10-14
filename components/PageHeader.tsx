import { BackLink } from '@/components/ui/BackLink'
import { LabelBlock } from '@/components/ui/LabelBlock'

interface Props {
  /**
   * Optional "‹ Parent" up-link rendered above the eyebrow, for app-like pages
   * with no breadcrumb (installed-PWA users have no browser Back button).
   */
  back?: { href: string; label: string }
  /**
   * The label block above the H1 (the page's ROLE / section). Normally a plain
   * string. ReactNode is allowed ONLY to prefix the label with a status glyph —
   * /bench's live-testing pulse is the sanctioned case. It is NOT a slot for
   * chips, links, or a second line: the label names the role once (eyebrow
   * doctrine, brand-guide §3).
   */
  eyebrow: React.ReactNode
  /** Page title — uppercase Montserrat black (one voice; Hard Goods). */
  title: string
  /** Optional one- or two-line deck under the title. */
  deck?: string
  /** Optional right-hand slot (filters, a CTA, a count) aligned to the title. */
  actions?: React.ReactNode
  /**
   * `compact` — app pages (account, cart, order, tools, savings, the Boss,
   * goals, auth; continuity plan D3): the same lockup at 2xl/3xl, with NO
   * page-width wrapper or padding, so the caller's column (max-w-xl on a form,
   * max-w-3xl on a tool) governs. Actions show at every width — on an app page
   * they're controls, not decoration.
   */
  size?: 'default' | 'compact'
  /** Spacing below the header — compact only (the default size owns its own). */
  className?: string
}

/**
 * The interior page header — every listing, category, tag and editorial page
 * (homepage and /about excepted). Hard Goods (2026-10-14, brand-guide §5/§10.1):
 * a black label block (the role) → uppercase Montserrat black H1 → optional
 * deck, closed by a 3px chrome-black rule — the same lockup `EditorialHeader`
 * draws at section level, one size up. The quiet grey eyebrow + hairline it
 * replaces was the main reason the listings read "plain" after the light flip.
 * Consumers are all short-titled pages; long detail titles have their own H1.
 */
export default function PageHeader({ back, eyebrow, title, deck, actions, size = 'default', className = '' }: Props) {
  if (size === 'compact') {
    return (
      <header className={`pb-5 border-b-[3px] border-chrome ${className}`}>
        {back && <BackLink href={back.href} label={back.label} className="mb-3" />}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <LabelBlock>{eyebrow}</LabelBlock>
            <h1 className="font-black text-prose uppercase text-2xl sm:text-3xl leading-[1.05] tracking-[-0.01em] mt-3">
              {title}
            </h1>
            {deck && <p className="text-base text-prose-muted leading-relaxed mt-2 max-w-2xl">{deck}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </header>
    )
  }
  return (
    <header>
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-6 md:pt-14 md:pb-8 border-b-[3px] border-chrome">
        {back && <BackLink href={back.href} label={back.label} className="mb-3" />}
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <LabelBlock>{eyebrow}</LabelBlock>
            <h1 className="font-black text-prose uppercase text-4xl md:text-5xl leading-[1.0] tracking-[-0.01em] mt-3">
              {title}
            </h1>
            {deck && (
              <p className="text-base md:text-lg text-prose-muted leading-relaxed mt-4 max-w-2xl">
                {deck}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0 hidden md:block">{actions}</div>}
        </div>
      </div>
    </header>
  )
}
