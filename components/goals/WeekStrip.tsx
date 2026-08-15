// This week, as seven chips.
//
// Replaces a sentence ("Nothing open right now. Next one lands 2026-08-17 at 19:00.")
// with something you read at a glance and can point at. Same idea as the day strip
// every habit tracker puts at the top of its home screen, and the same data as the
// history grid — it renders `HistoryCell`s from `buildHistoryGrid`, so the strip, the
// grid and the streak cannot disagree about a day.
//
// Server Component, no client bundle. Hover is a native `title`, and the state of
// each day is carried by fill AND shape, never by colour alone:
//
//   kept     filled accent          extra    accent ring
//   skipped  filled neutral         missed   hairline outline
//   open     dashed outline         none     barely-there
//
// TODAY is marked structurally rather than with another colour — the number goes
// bold and gets a ring, so "which day is it" survives greyscale and forced colours.

import { WEEKDAY_INITIALS, type CellState, type HistoryCell } from '@/lib/goals/history'

const CELL_CLASS: Record<CellState, string> = {
  kept:    'bg-accent',
  extra:   'border-2 border-accent',
  skipped: 'bg-zinc-500',
  missed:  'border border-strong',
  open:    'border border-dashed border-strong',
  none:    'bg-surface-raised',
}

const STATE_WORD: Record<CellState, string> = {
  kept: 'done', extra: 'extra log', skipped: 'skipped',
  missed: 'missed', open: 'coming up', none: 'nothing due',
}

type Props = {
  /** Exactly one week, aligned to WEEK_STARTS_ON — gridWindow(today, 1). */
  cells: HistoryCell[]
  /** Today in the relevant zone. Marks the current chip. */
  todayLocal: string
  /** Display unit for the title text, space-prefixed (" lb"). */
  unit?: string
}

export default function WeekStrip({ cells, todayLocal, unit = '' }: Props) {
  if (cells.length !== 7) return null

  return (
    <div className="grid grid-cols-7 gap-1" role="list" aria-label="This week">
      {cells.map((cell, i) => {
        const isToday = cell.date === todayLocal
        return (
          <div
            key={cell.date}
            role="listitem"
            className="flex flex-col items-center gap-1"
            title={`${cell.date} — ${STATE_WORD[cell.state]}${
              cell.value != null ? ` · ${cell.value}${unit}` : ''
            }`}
          >
            <span
              className={`text-[10px] leading-none ${
                isToday ? 'font-bold text-prose' : 'text-prose-faint'
              }`}
            >
              {WEEKDAY_INITIALS[i]}
            </span>
            {/* The day number sits inside the chip so the strip reads as a calendar
                rather than a legend. `tabular-nums` because these DO align in a row. */}
            <span
              className={[
                'flex h-8 w-full items-center justify-center text-[11px] tabular-nums',
                CELL_CLASS[cell.state],
                cell.state === 'kept' ? 'text-white' : 'text-prose-faint',
                // No chain in the strip. Seven cells don't need one, the grid below
                // carries it, and a negative margin fighting a ring on "today" is
                // visual risk for no information gain.
                'rounded-md',
                isToday ? 'ring-1 ring-accent' : '',
              ].join(' ')}
            >
              {cell.date.slice(8)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
