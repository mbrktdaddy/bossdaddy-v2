// The instrument deck — the toolbox's one panel.
//
// Hard Goods Tools anatomy: a dark zone, the 4px orange rule, an orange kicker, a white
// title and a hot-orange button. It replaces the PageHeader on /tools, so it carries
// the page's h1. For a MEMBER its body is the day's readouts and rows (TodayCard in
// deck mode). For a VISITOR it is the DEMO STATE (brand-guide §11, 2026-11-13): the
// same instrument with no readings — the pitch where the greeting goes, dashes where
// the numbers would be, Create account / Sign in where the day's button is. Both get
// the launcher as a dock of keys (ToolTiles in dock mode); the tools that need an
// account say so on their own pages. The rest of the page is utility boxes, so this is
// the page's one panel.

import Link from 'next/link'
import TodayCard from '@/components/goals/TodayCard'
import ToolTiles from '@/components/dad-tools/ToolTiles'
import { buttonVariants } from '@/components/ui/Button'

export interface DeckDemo {
  /** The pitch, under the title. */
  body: string
  /** The one-line promise under the empty readouts. */
  note: string
  signInHref: string
  registerHref: string
}

export default function ToolboxDeck({
  greeting, title, userId, demo, className = '',
}: {
  greeting: string
  title: string
  /** The member; omit for the demo state. */
  userId?: string
  /** The demo state; omit for a member. */
  demo?: DeckDemo
  className?: string
}) {
  return (
    <section
      data-theme="dark"
      aria-label={title}
      className={`bg-chrome app:bg-surface text-prose border-t-4 border-accent rounded-xl overflow-hidden ${className}`}
    >
      <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6">
        <p className="font-display font-extrabold text-[11px] uppercase tracking-[0.16em] text-accent-text">
          {greeting}
        </p>
        <h1 className="mt-2 font-black text-[28px] sm:text-[36px] leading-[0.95] tracking-[-0.02em] text-prose">
          {title}
        </h1>
        {demo ? <DemoBody {...demo} /> : userId ? <TodayCard userId={userId} variant="deck" /> : null}
      </div>
      <ToolTiles />
    </section>
  )
}

/** The instrument with no readings: honest about being empty, never fake numbers. */
function DemoBody({ body, note, signInHref, registerHref }: DeckDemo) {
  return (
    <>
      <p className="mt-3 text-sm sm:text-base text-prose-muted max-w-[52ch]">{body}</p>
      <div className="mt-5 border-t border-soft pt-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid grid-cols-2 gap-6" aria-hidden>
            <EmptyReadout label="Waiting on you" />
            <EmptyReadout label="Later on" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={registerHref} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
              Create account
            </Link>
            <Link href={signInHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Sign in
            </Link>
          </div>
        </div>
        <p className="mt-3 text-xs text-prose-faint max-w-[52ch]">{note}</p>
      </div>
    </>
  )
}

function EmptyReadout({ label }: { label: string }) {
  return (
    <div>
      <span className="block font-black text-[40px] leading-none tabular-nums text-prose-faint">—</span>
      <span className="mt-1.5 block text-[10px] uppercase tracking-widest text-prose-faint">{label}</span>
    </div>
  )
}
