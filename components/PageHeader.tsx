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
export default function PageHeader({ back, eyebrow, title, deck, actions }: Props) {
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
