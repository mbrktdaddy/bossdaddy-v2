// The instrument deck — the signed-in toolbox's one black panel.
//
// Hard Goods Tools anatomy: a dark zone, the 4px orange rule, an orange kicker, a white
// title and a hot-orange button. It replaces the PageHeader for members, so it carries
// the page's h1, the day's readouts and rows (TodayCard in deck mode) and the launcher
// as a dock of keys (ToolTiles in dock mode). The rest of the page is bench boxes on the
// white canvas, so the black budget is this one panel.

import TodayCard from '@/components/goals/TodayCard'
import ToolTiles from '@/components/dad-tools/ToolTiles'

export default function ToolboxDeck({
  userId, greeting, title, className = '',
}: { userId: string; greeting: string; title: string; className?: string }) {
  return (
    <section
      data-theme="dark"
      aria-label={title}
      className={`bg-chrome text-prose border-t-4 border-accent rounded-xl overflow-hidden ${className}`}
    >
      <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6">
        <p className="font-display font-extrabold text-[11px] uppercase tracking-[0.16em] text-accent-text">
          {greeting}
        </p>
        <h1 className="mt-2 font-black text-[28px] sm:text-[36px] leading-[0.95] tracking-[-0.02em] text-prose">
          {title}
        </h1>
        <TodayCard userId={userId} variant="deck" />
      </div>
      <ToolTiles variant="dock" />
    </section>
  )
}
