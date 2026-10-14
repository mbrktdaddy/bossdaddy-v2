import EditorialHeader from '@/components/EditorialHeader'
import { LABELS } from '@/lib/labels'
import { ToolCard } from '@/components/dad-tools/ToolCard'

const TOOLS = [
  {
    href: '/tools/the-boss',
    kicker: `${LABELS.tools.theBoss.spokeRole} · ${LABELS.tools.theBoss.short}`,
    title: 'Tell the Boss what you need. Get a straight answer.',
    blurb: 'How-to, gear questions, a toast you have to give, a hard talk you need to have — plain English, from a voice in your corner.',
    cta: 'Ask the Boss',
  },
  {
    href: '/tools/weekends-until',
    kicker: `${LABELS.tools.weekendsUntil.spokeRole} · ${LABELS.tools.weekendsUntil.short}`,
    title: 'How many weekends do you have left with your kid?',
    blurb: 'Pick a birthdate. Pick a milestone. Get the number. Then make them count.',
    cta: 'Try it',
  },
  {
    href: '/tools/savings',
    kicker: `${LABELS.tools.savings.spokeRole} · ${LABELS.tools.savings.short}`,
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
            <ToolCard key={t.href} href={t.href} kicker={t.kicker} title={t.title} blurb={t.blurb} cta={t.cta} />
          ))}
        </div>
      </div>
    </section>
  )
}
