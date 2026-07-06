interface Props {
  /** Small uppercase kicker above the H1 (the page's ROLE / section). */
  eyebrow: string
  /** Page title — rendered in the Fraunces editorial serif. */
  title: string
  /** Optional one- or two-line deck under the title. */
  deck?: string
  /** Optional right-hand slot (filters, a CTA, a count) aligned to the title. */
  actions?: React.ReactNode
}

/**
 * Manifesto v2 interior page header — the "slim editorial band" used on every
 * non-homepage page (listings, detail, tools, editorial). Eyebrow + big
 * Fraunces H1 + optional deck + hairline rule, on the dark canvas, no photo
 * required. This is the site-wide replacement for ad-hoc page titles so
 * interior pages carry the same DNA as the homepage. (docs/home-manifesto-spec.md)
 */
export default function PageHeader({ eyebrow, title, deck, actions }: Props) {
  return (
    <header className="border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-eyebrow">
              {eyebrow}
            </p>
            <h1 className="font-editorial-display font-semibold text-prose text-4xl md:text-5xl leading-[1.03] tracking-tight mt-3">
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
