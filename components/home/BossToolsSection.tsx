import Link from 'next/link'
import EditorialHeader from '@/components/EditorialHeader'
import { LABELS } from '@/lib/labels'
import { buttonVariants } from '@/components/ui/Button'

const TOOLS = [
  {
    href: '/tools/the-boss',
    kicker: 'Ask · The Boss',
    title: 'Tell the Boss what you need. Get a straight answer.',
    blurb: 'How-to, gear questions, a toast you have to give, a hard talk you need to have — plain English, from a voice in your corner.',
    cta: 'Ask the Boss',
  },
  {
    href: '/tools/weekends-until',
    kicker: `Time · ${LABELS.tools.weekendsUntil.short}`,
    title: 'How many weekends do you have left with your kid?',
    blurb: 'Pick a birthdate. Pick a milestone. Get the number. Then make them count.',
    cta: 'Try it',
  },
  {
    href: '/tools/savings',
    kicker: 'Money · Savings',
    title: 'Small commitments, daily. Watch the dollars stack.',
    blurb: '$2 a day for a camping trip. $50 a month into a 529. Tiny habits, real progress. Invite your spouse so the streak counts as a team.',
    cta: 'Try it',
  },
]

/**
 * Tools — three BLACK panels (Hard Goods, 2026-10-14; brand-guide §6/§10).
 * The utility lane is where the dark moments live on the white page: each
 * tile is a `data-theme="dark"` zone with a 4px orange top rule, an orange
 * kicker, white title, faint blurb and the hot-orange button. The 2026-10-08
 * soft grey panels were the first thing he named as "plain" — a tool should
 * look like a tool, not a paragraph. Still image-free on purpose: the black
 * is what carries the tiles.
 */
export default function BossToolsSection() {
  return (
    <section className="border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
        <EditorialHeader
          eyebrow="Tools"
          title="Built for the job"
          right={{ label: 'All tools', href: '/tools' }}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 md:gap-5">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              data-theme="dark" /* a dark ZONE per tile — tokens invert inside */
              className="group flex flex-col bg-chrome text-prose border-t-4 border-accent rounded-xl p-5 sm:p-6"
            >
              <p className="font-display font-extrabold text-[11px] uppercase tracking-[0.16em] text-accent-text">
                {t.kicker}
              </p>
              <h3 className="text-[21px] font-black mt-2.5 text-prose leading-[1.1] tracking-[-0.02em] group-hover:text-accent-text transition-colors">
                {t.title}
              </h3>
              <p className="text-prose-faint mt-2.5 text-sm flex-1">{t.blurb}</p>
              {/* A styled span, not a nested control — the whole tile is the link. */}
              <span className={buttonVariants({ size: 'sm', className: 'self-start mt-5' })}>
                {t.cta}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
