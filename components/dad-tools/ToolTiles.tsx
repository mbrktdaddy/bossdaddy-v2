// The tool shelf, for somebody who already knows what these are.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY TWO SHELVES, NOT ONE COMPROMISE
//
// The spoke cards carry a two-sentence pitch each — "Tested gear picks, straight
// answers, and dad-life help, grounded in real reviews. Just ask the Boss." That copy
// is doing real work for a visitor who has never used the tool, and NO work for a
// member who opens this page every morning. Five of them stacked below his actual
// goals is five paragraphs of advertising between him and the thing he came for.
//
// So the page branches on the gate it already had for the hero: a signed-in dad gets
// these tiles, a visitor keeps the cards. Nothing is lost from either audience, and
// the daily case drops from ~1,100px of shelf to ~170px.
//
// ICONS ARE BUILT FROM RECTS, CIRCLES AND SHORT PATHS on purpose — not hand-copied
// bézier data. A malformed path renders as a smear and nobody notices until it ships;
// primitives are legible in the source and cannot be subtly wrong. House style is the
// one already in MobileBottomNav and CategoryIcon: 24×24, no fill, currentColor
// stroke, 1.5 weight, round joins.
//
// NO DUE BADGE HERE, DELIBERATELY. The Today card sits directly above this on /tools
// and already says how many things are waiting. A badge on the Goals tile would print
// the same number twice on one screen, and the second one would be the one that goes
// stale first. If it's ever wanted, the count is a prop away.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link'
import { LABELS } from '@/lib/labels'

const ICON = 'w-6 h-6'

function svgProps(className: string) {
  return {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
}

/** Ask — a speech bubble. */
function AskIcon() {
  return (
    <svg {...svgProps(ICON)}>
      <rect x="3.25" y="4.75" width="17.5" height="11.5" rx="2.75" />
      <path d="M9 16.25V20l4.25-3.75" />
    </svg>
  )
}

/** Time — a calendar. */
function CalendarIcon() {
  return (
    <svg {...svgProps(ICON)}>
      <rect x="3.25" y="5.25" width="17.5" height="15" rx="2.5" />
      <path d="M3.25 10.25h17.5M8 3.25v3.5M16 3.25v3.5" />
    </svg>
  )
}

/** Money — a banknote. */
function NoteIcon() {
  return (
    <svg {...svgProps(ICON)}>
      <rect x="2.5" y="6.75" width="19" height="10.5" rx="2.25" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  )
}

/** Track — a bullseye. Reads as "target" faster than a tick does. */
function TargetIcon() {
  return (
    <svg {...svgProps(ICON)}>
      <circle cx="12" cy="12" r="8.75" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Planning — a calculator. Exported for the Calculators section on /tools. */
export function CalculatorIcon() {
  return (
    <svg {...svgProps(ICON)}>
      <rect x="5.25" y="3.25" width="13.5" height="17.5" rx="2.5" />
      <path d="M8.75 7.5h6.5" />
      <path d="M9.25 12h.01M12 12h.01M14.75 12h.01M9.25 16h.01M12 16h.01M14.75 16h.01" />
    </svg>
  )
}

type Tile = { href: string; label: string; Icon: () => React.JSX.Element }

/**
 * THE FOUR DAILY TOOLS, and only those. Dad Math moved out to its own Calculators
 * section: it's a thing you reach for while planning, not part of the daily loop, and
 * that section is about to have company. A launcher row is for the things you open
 * without thinking.
 */
const TILES: Tile[] = [
  { href: '/tools/the-boss',       label: LABELS.tools.theBoss.short,       Icon: AskIcon },
  { href: '/tools/weekends-until', label: LABELS.tools.weekendsUntil.short, Icon: CalendarIcon },
  { href: '/tools/savings',        label: LABELS.tools.savings.short,       Icon: NoteIcon },
  { href: '/goals',                label: LABELS.goals.short,               Icon: TargetIcon },
]

export default function ToolTiles({ className = '' }: { className?: string }) {
  return (
    <nav className={className} aria-label="Your tools">
      {/* FOUR ACROSS AT EVERY WIDTH. At 393px that's ~82px a tile after padding and
          gaps — enough for a 24px icon and a label on one line, including the longest
          ("Milestones"). A launcher that reflows between three and four columns stops
          being muscle memory, which is the entire value of a launcher. */}
      <ul className="grid grid-cols-4 gap-2 sm:gap-3">
        {TILES.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={[
                'group flex min-h-[76px] flex-col items-center justify-center gap-1.5',
                'rounded-xl border border-soft bg-surface px-1.5 py-3 text-center',
                'transition-colors hover:border-accent',
              ].join(' ')}
            >
              {/* ORANGE ICON, PROSE LABEL. The icon carries the brand and the eye lands
                  on it first; the label stays ink so four accent words in a row don't
                  read as four links shouting. accent clears 3:1 against this surface —
                  measured with the palette validator, not eyeballed. */}
              <span className="text-accent transition-colors group-hover:text-accent-hover">
                <Icon />
              </span>
              <span className="text-[11px] font-semibold leading-tight text-prose-muted transition-colors group-hover:text-prose">
                {label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
