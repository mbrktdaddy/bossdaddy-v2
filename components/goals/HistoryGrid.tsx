// One month of a goal, as a calendar.
//
// A Server Component with no client bundle, matching the page it sits on. Month
// navigation is a plain link, so paging back through history costs no JavaScript.
// The hover layer is a native `title` per day — the no-JS equivalent of a tooltip,
// and the reason a value is never colour-only.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY A MONTH, AND WHY MOST DAYS ARE JUST NUMBERS
//
// This was twelve weeks of filled tiles. On a goal a fortnight old that is 84 cells
// carrying five facts — eighty-odd grey squares, twelve rows tall, that read as a
// mosaic and cost more screen than the information in them. Two changes, and the
// second matters more than the first:
//
//   1. A MONTH. Half the height, a frame everybody already owns, and it still runs
//      weekday-across so a run of kept days can be drawn as one bar.
//   2. AN UNSCHEDULED DAY IS NOT A TILE. It's a plain number. Only a day with
//      something to say gets a mark, so marks read as marks instead of as texture.
//
// The long view didn't need defending: best run, the 30-day rate and all-time kept
// are already three big numbers directly above this.
//
// NO RED. ANYWHERE. FOR ANY GOAL.
// Migration 136 promised "no red heatmap cells" for a sensitive goal, which implies a
// branch. There isn't one: a missed day is a fact we record and never an event we
// announce, and a cessation calendar glowing red across a bad fortnight is the exact
// failure brand-guide §1.6 exists to prevent. The palette carries no alarm colour at
// all, so the promise holds by construction rather than by checking a boolean.
//
// STATE IS ENCODED TWICE — fill AND shape:
//   kept     filled accent            extra    accent ring, hollow
//   skipped  filled neutral           missed   hairline outline
//   open     dashed outline           none     no mark, number only
// So it still reads under any colour-vision deficiency and in forced-colours mode,
// where fills flatten but borders survive.
//
// Colours were validated, not eyeballed: the first pass used the border tiers for the
// neutral states and the palette validator put them at 1.67:1 against the card —
// invisible. accent (#E55A1A) and zinc-500 clear 3:1 with CVD ΔE 12.6.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link'
import {
  summarizeGrid, WEEKDAY_INITIALS, type CellState, type HistoryCell,
} from '@/lib/goals/history'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * The mark drawn behind the day number. `none` and `open` draw nothing at all.
 *
 * ⚠️ `open` IS DELIBERATELY UNMARKED HERE. It rendered as a dashed outline, which on
 * a daily goal early in the month meant sixteen dashed boxes for days that hadn't
 * happened yet — more visual weight than the four days that had. This is the HISTORY
 * calendar; what's coming is the week strip's job and the today card's job. A month
 * you're two days into should look nearly empty, because it nearly is.
 */
const CELL_CLASS: Record<CellState, string> = {
  kept:    'bg-accent text-white',
  extra:   'border-2 border-accent text-prose',
  skipped: 'bg-zinc-500 text-white',
  missed:  'border border-strong text-prose-muted',
  open:    'text-prose-faint',
  none:    'text-prose-faint',
}

const STATE_WORD: Record<CellState, string> = {
  kept: 'done', extra: 'extra log', skipped: 'skipped',
  missed: 'missed', open: 'coming up', none: 'nothing due',
}

type Props = {
  /** Whole weeks covering the month — monthGridWindow() guarantees the alignment. */
  cells: HistoryCell[]
  /** `YYYY-MM` — which month these cells are FOR. Days outside it grey out. */
  month: string
  /** Null when there's no history before this month, or none after it. */
  prevHref: string | null
  nextHref: string | null
  /** Display unit, e.g. " lb". Already space-prefixed by the caller. */
  unit?: string
}

export default function HistoryGrid({ cells, month, prevHref, nextHref, unit = '' }: Props) {
  if (!cells.length) return null

  // The summary describes THIS MONTH, so days padded in from the neighbours don't
  // get counted in it.
  const inMonth = cells.filter((cell) => cell.date.startsWith(month))
  const counts = summarizeGrid(inMonth)
  const monthIndex = Number(month.slice(5, 7)) - 1

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-prose uppercase tracking-wide">
          {MONTH_NAMES[monthIndex] ?? month} {month.slice(0, 4)}
        </h2>
        {/* Plain links, so history is reachable with JavaScript off and each month is
            its own URL you can sit on. Absent rather than disabled at the ends —
            a dead control is worse than no control. */}
        <div className="flex items-center gap-1">
          {prevHref ? (
            <Link
              href={prevHref}
              aria-label="Previous month"
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-sm text-prose-muted hover:bg-surface-hover"
            >
              ←
            </Link>
          ) : null}
          {nextHref ? (
            <Link
              href={nextHref}
              aria-label="Next month"
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-sm text-prose-muted hover:bg-surface-hover"
            >
              →
            </Link>
          ) : null}
        </div>
      </div>

      {/* The accessible twin of the calendar: the same facts as a sentence, before the
          picture. Nothing to say means no sentence — a month reading "0 logged" on a
          goal that hadn't started yet was the emptiness this whole change is about. */}
      {counts.kept + counts.extra + counts.skipped + counts.missed > 0 ? (
        <p className="text-sm text-prose-muted">
          {/* Only what the calendar below actually draws. It used to end with
              "· 16 still to come", which was true and had nothing to point at once
              future days stopped being marked — a summary should describe the
              picture, not out-narrate it. What's next lives in the week strip. */}
          <span className="text-prose font-semibold">{counts.kept + counts.extra}</span> logged
          {counts.missed > 0 ? <> · {counts.missed} missed</> : null}
          {counts.skipped > 0 ? <> · {counts.skipped} skipped</> : null}
        </p>
      ) : null}

      <div className="rounded-xl border border-soft bg-surface p-3">
        {/* aria-hidden: the sentence above carries the same facts, and a screen reader
            reading out forty undifferentiated cells is worse than silence. */}
        <div className="grid grid-cols-7" aria-hidden="true">
          {/* THE HEADER HAS TO READ AS AN AXIS, NOT AS ANOTHER ROW OF NUMBERS.
              These were text-[10px] text-prose-faint while an unmarked day number is
              text-[11px] text-prose-faint — the same colour at nearly the same size,
              so the top row announced nothing and the grid read as eight rows of grey
              instead of a header plus six weeks.

              Four differentiators, none of them colour-alone: brighter ink (muted vs
              faint), bolder weight, a hair larger, and a hairline rule under the row.
              Seven adjacent border-b spans make one continuous line, which is the
              part that actually separates axis from data.

              Deliberately NOT the accent/eyebrow orange: in this component accent
              means "you did it", and spending it on chrome would make the header
              compete with the days that matter. */}
          {WEEKDAY_INITIALS.map((day, i) => (
            <span
              key={`day-${i}`}
              className="mb-1.5 border-b border-soft pb-2 text-center text-[11px] font-bold uppercase leading-none text-prose-muted"
            >
              {day}
            </span>
          ))}

          {/* ⚠️ NO CHAIN. DON'T RE-ADD ONE.
              Two attempts at drawing a run as a joined bar were both reported as
              rendering bugs. The first reshaped the chained cell (`-ml-[4px]`
              + squared corner), which grew its box and pushed the day number
              off-axis from every other column — see brand-guide §2, "State is
              encoded with colour, never with geometry". The second kept the cells
              uniform and laid a connector across the gutter, and that fused two
              tiles into one lumpy block while an adjacent skipped→logged pair stayed
              separate, so the silhouette read as a defect rather than as a streak.

              Adjacent fills and the day numbers already show a run, and the actual
              number lives in the "running" tile above. Every day here is the same
              square with the same radius and its number dead centre. */}
          {cells.map((cell) => {
            const outside = !cell.date.startsWith(month)
            return (
              <div
                key={cell.date}
                className="p-[2px]"
                title={outside ? undefined : `${cell.date} — ${STATE_WORD[cell.state]}${
                  cell.value != null ? ` · ${cell.value}${unit}` : ''
                }${cell.target != null ? ` · target ${cell.target}${unit}` : ''}`}
              >
                <div
                  className={[
                    'flex aspect-square items-center justify-center rounded-md',
                    'text-[11px] tabular-nums',
                    // Padding days keep their number so the weeks stay legible as
                    // weeks, but they carry no state — they aren't this month's story.
                    outside ? 'text-prose-faint/40' : CELL_CLASS[cell.state],
                  ].join(' ')}
                >
                  {cell.date.slice(8)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* A legend is always present — identity is never colour alone — but only for
          states this month actually had. Listing "skipped · missed · coming up" on a
          clean month teaches a vocabulary of failures nobody earned, and buries the
          one or two states that are really there. */}
      {counts.kept + counts.extra + counts.skipped + counts.missed > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-prose-faint">
          {/* `open` is absent: it draws no mark now, so a swatch for it would be a
              legend entry pointing at nothing. */}
          {(['kept', 'extra', 'skipped', 'missed'] as const)
            .filter((state) => counts[state] > 0)
            .map((state) => (
              <li key={state} className="flex items-center gap-1.5">
                <span
                  className={`h-3 w-3 rounded-[3px] ${CELL_CLASS[state]}`}
                  aria-hidden="true"
                />
                {STATE_WORD[state]}
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  )
}
