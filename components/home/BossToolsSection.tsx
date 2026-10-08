import Link from 'next/link'
import EditorialHeader from '@/components/EditorialHeader'
import { LABELS } from '@/lib/labels'
import { Eyebrow } from '@/components/ui/Eyebrow'

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
 * Tools — three equal tiles (Phase 5, 2026-10-08). Was a full-width Ask card
 * over a 2-up; the equal row is shorter and reads as one shelf. Soft raised
 * panels, not outlined boxes — the tiles are image-free, so the panel is what
 * separates them from the canvas. The only image-free content section on the
 * page, which is why it sits mid-scroll as the breath between image sections.
 */
export default function BossToolsSection() {
  return (
    <section className="border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
        <EditorialHeader
          eyebrow="Free · No login wall"
          title="Tools"
          right={{ label: 'All tools', href: '/tools' }}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="flex flex-col bg-surface-raised hover:bg-surface-hover rounded-2xl p-6 transition-colors group"
            >
              <Eyebrow>{t.kicker}</Eyebrow>
              <h3 className="text-xl font-black mt-2 text-prose group-hover:text-accent transition-colors leading-tight tracking-tight">
                {t.title}
              </h3>
              <p className="text-prose-muted mt-3 text-sm flex-1">{t.blurb}</p>
              <p className="text-sm text-accent font-semibold mt-5 inline-flex items-center gap-1 group-hover:underline">
                {t.cta} <span aria-hidden>→</span>
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
