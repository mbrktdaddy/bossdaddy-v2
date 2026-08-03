import Link from 'next/link'
import EditorialHeader from '@/components/EditorialHeader'

/**
 * Boss Tools — the homepage's only image-free content section, which is why it
 * sits mid-scroll rather than near the footer. Wirecutter parks its Finder module
 * in the same slot: between two image-heavy sections, where the job is the pause
 * as much as the click. It used to run after the Creed, which meant five image
 * sections stacked before anything broke the rhythm.
 *
 * Extracted from page.tsx verbatim (no data dependencies — every card is static),
 * purely so the section can move without dragging sixty lines of JSX with it.
 */
export default function BossToolsSection() {
  return (
    <section className="border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        <EditorialHeader
          eyebrow="Free · No login wall"
          title="Boss Tools"
          right={{ label: 'See all tools', href: '/tools' }}
        />
        <Link
          href="/tools/the-boss"
          className="block bg-surface border border-soft hover:border-accent rounded-2xl p-6 sm:p-8 mb-4 transition-colors group"
        >
          <p className="text-xs text-eyebrow uppercase tracking-widest font-bold">New · Ask the Boss</p>
          <h3 className="text-xl sm:text-2xl font-black mt-2 text-prose group-hover:text-accent transition-colors leading-tight">
            Tell the Boss what you need — get a tested pick, not a guess.
          </h3>
          <p className="text-prose-muted mt-3 text-sm sm:text-base max-w-prose">
            Recommendations grounded in real, hands-on reviews — plus straight answers on how-to,
            planning, and dad life. Picks come with scores and buy links; the takes come in plain English.
          </p>
          <p className="text-sm text-accent font-semibold mt-5 inline-flex items-center gap-1 group-hover:underline">
            Ask the Boss <span aria-hidden>→</span>
          </p>
        </Link>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Link
            href="/tools/weekends-until"
            className="block bg-surface border border-soft hover:border-accent rounded-2xl p-6 sm:p-8 transition-colors group"
          >
            <p className="text-xs text-eyebrow uppercase tracking-widest font-bold">Time · Weekends Until</p>
            <h3 className="text-xl sm:text-2xl font-black mt-2 text-prose group-hover:text-accent transition-colors leading-tight">
              How many weekends do you have left with your kid?
            </h3>
            <p className="text-prose-muted mt-3 text-sm sm:text-base max-w-prose">
              Pick a birthdate. Pick a milestone. Get the number. Then make them count.
            </p>
            <p className="text-sm text-accent font-semibold mt-5 inline-flex items-center gap-1 group-hover:underline">
              Try it <span aria-hidden>→</span>
            </p>
          </Link>
          <Link
            href="/tools/savings"
            className="block bg-surface border border-soft hover:border-accent rounded-2xl p-6 sm:p-8 transition-colors group"
          >
            <p className="text-xs text-eyebrow uppercase tracking-widest font-bold">Money · Savings</p>
            <h3 className="text-xl sm:text-2xl font-black mt-2 text-prose group-hover:text-accent transition-colors leading-tight">
              Small commitments, daily. Tap “yes,” watch the dollars stack.
            </h3>
            <p className="text-prose-muted mt-3 text-sm sm:text-base max-w-prose">
              $2 a day for a camping trip. $50 a month into a 529 or Trump Account. Tiny habits, real
              progress. Invite your spouse so the streak counts as a team.
            </p>
            <p className="text-sm text-accent font-semibold mt-5 inline-flex items-center gap-1 group-hover:underline">
              Try it <span aria-hidden>→</span>
            </p>
          </Link>
        </div>
      </div>
    </section>
  )
}
