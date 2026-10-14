import { BRAND } from '@/lib/brand'
import { buttonVariants } from '@/components/ui/Button'

interface Props {
  eyebrow?: string
  heading?: string
  subhead?: string
  /** Defaults to /api/newsletter/subscribe — overridable for re-use in other contexts. */
  action?: string
  /**
   * Defaults to the brand action line ("Boss Up.") — brand-guide §1.7 names *button
   * text* as a primary usage for it, and this is the site's one real call to join.
   * It's the only placement that line has anywhere in the app.
   *
   * The trade-off is deliberate: a branded label is less literal than "Subscribe".
   * It stays unambiguous because it sits beside an email field, under "Sunday
   * morning. One email." and "Unsubscribe anytime" — the context carries the
   * meaning, the button carries the voice. Pass `buttonLabel="Subscribe"` to revert.
   */
  buttonLabel?: string
  /** Comma-separated list of interest tags persisted with the subscription. */
  interests?: string
}

/**
 * The newsletter block — Hard Goods (2026-10-14; brand-guide §6/§10). The
 * page's one solid ORANGE block: uppercase Montserrat black headline, a white
 * field with a 2px black edge, a black button. Ink is the chrome black
 * (4.6:1 on the core orange — the page's prose black misses AA here, and
 * white-on-orange misses it everywhere, so this is not a dark zone). Two
 * columns on lg, stacked on a phone. The 2026-10-08 version was a centred
 * white section with a 3px orange top rule; it read as a form, not a moment.
 */
export default function EmailCaptureSection({
  eyebrow = 'The Weekly Drop',
  heading = 'Sunday morning. One email.',
  subhead = "New reviews, what I'm testing, and the verdicts about to drop. No PR-speak. Unsubscribe anytime.",
  action = '/api/newsletter/subscribe',
  buttonLabel = BRAND.actionLine,
  interests = 'newsletter',
}: Props) {
  return (
    <section className="bg-accent text-chrome border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 py-11 md:py-16 grid gap-5 lg:grid-cols-2 lg:items-center lg:gap-10">
        <div>
          <p className="font-display font-extrabold text-[11px] uppercase tracking-[0.2em]">
            {eyebrow}
          </p>
          <h2 className="font-black uppercase text-[40px] md:text-[56px] leading-[0.95] tracking-[-0.03em] mt-2">
            {heading}
          </h2>
          <p className="font-semibold text-[15px] leading-relaxed mt-3 max-w-[46ch]">
            {subhead}
          </p>
        </div>
        {/* The button WRAPS to its own line on a phone (the input's basis-60 leaves
            no room beside it) and takes the full width there; from sm up the two
            sit in one row. */}
        <form action={action} method="POST" className="flex flex-wrap gap-2">
          <input type="hidden" name="interests" value={interests} />
          <label htmlFor="email-capture-input" className="sr-only">Email address</label>
          <input
            id="email-capture-input"
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="flex-1 min-w-0 basis-60 min-h-[48px] px-3.5 text-[15px] bg-surface border-2 border-chrome rounded-md text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-chrome/30 transition-shadow"
          />
          <button
            type="submit"
            className={buttonVariants({ variant: 'onBlock', size: 'lg', className: 'basis-full sm:basis-auto' })}
          >
            {buttonLabel}
          </button>
        </form>
      </div>
    </section>
  )
}
