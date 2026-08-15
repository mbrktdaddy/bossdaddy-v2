// Plan versus actual, for a goal that measures something.
//
// A weight goal shipped with a progress bar and no graph, which is the one thing
// every tracker in the field has. This is that graph, as a Server Component with no
// client bundle and no charting library — two polylines and a marker.
//
// ─────────────────────────────────────────────────────────────────────────────
// ONE AXIS, ONE MEASURE. Both series are the same unit (lb, cigarettes, hours), so
// they share a scale. A second y-axis here would invent a correlation out of where
// the two scales happened to be aligned — the single most common way a chart lies.
//
// THE TARGET LINE IS THE STAMPED HISTORY, not a recomputation.
// `goal_occurrences.target_value` is what the plan actually asked for on that day,
// written at materialization time (lib/goals/curve.ts). Re-deriving the curve at
// read time would silently redraw the past whenever he moved his end date.
//
// ENCODED TWICE: the target is dashed AND recessive grey; the actual is solid AND
// accent. So the pair survives colour-vision deficiency and forced-colours mode,
// which is also what lets the palette keep a grey that "reads gray" — the validator
// flags that for categorical identity, and this grey is a reference, not a rival.
// Contrast against the card was measured, not guessed: both steps clear 3:1.
//
// Dashing a DATA line is fine; dashing a gridline is not (it reads as a threshold).
// There are no gridlines here at all.
//
// NO IN-SVG LABELS. The endpoint value lives in the caption and in "Where it
// stands" above, so nothing can be clipped by the viewBox or collide at the right
// edge — and the value is never reachable only by hovering.
// ─────────────────────────────────────────────────────────────────────────────

import { buildTrendSeries, trendExtent, type HistoryCell } from '@/lib/goals/history'
import { daysBetween } from '@/lib/goals/curve'

const W = 320
const H = 96
const PAD_Y = 8

type Props = {
  cells: HistoryCell[]
  /** Display unit, space-prefixed by the caller (" lb"). */
  unit?: string
  metricLabel?: string | null
}

export default function MetricTrend({ cells, unit = '', metricLabel }: Props) {
  const points = buildTrendSeries(cells)
  const logged = points.filter((p) => p.value != null)

  // Two readings is the floor for a line. One reading is a stat, and the page
  // already shows it — a single-point chart is the same mistake as a one-bar bar.
  if (logged.length < 2) return null

  const extent = trendExtent(points)
  if (!extent) return null

  const first = points[0].date
  const span = daysBetween(first, points[points.length - 1].date) ?? 0
  if (span <= 0) return null

  const x = (date: string) => ((daysBetween(first, date) ?? 0) / span) * W
  const y = (value: number) =>
    H - PAD_Y - ((value - extent.min) / (extent.max - extent.min)) * (H - PAD_Y * 2)

  const line = (pick: (p: typeof points[number]) => number | null) =>
    points
      .filter((p) => pick(p) != null)
      .map((p) => `${x(p.date).toFixed(1)},${y(pick(p)!).toFixed(1)}`)
      .join(' ')

  // A polyline needs two points to draw anything, and a legend must never advertise
  // a series that isn't on screen. A goal early in its plan often has exactly one
  // stamped target in the window — the first scheduled day — so this is the common
  // case, not an edge one. Gating the line string here gates the legend too.
  const targetLine = points.filter((p) => p.target != null).length >= 2
    ? line((p) => p.target)
    : ''
  const actualLine = line((p) => p.value)
  const last = logged[logged.length - 1]

  const name = metricLabel ?? 'value'
  const summary = `${name} over the last weeks: ${logged.length} readings, `
    + `latest ${last.value}${unit}`
    + (last.target != null ? `, target that day ${last.target}${unit}` : '')

  return (
    <div className="rounded-xl border border-soft bg-surface p-4">
      {/* role="img" + a full sentence: a screen reader gets the trend, not 40
          coordinate pairs. The Log list below is the table-view twin. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={summary}
        className="overflow-visible"
      >
        {targetLine ? (
          <polyline
            points={targetLine}
            fill="none"
            strokeWidth={2}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            className="stroke-prose-faint"
          />
        ) : null}
        <polyline
          points={actualLine}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="stroke-accent"
        />
        {/* The endpoint, ringed in the surface colour so it reads clear of the line
            it sits on. 8px across — a marker you can actually see. */}
        <circle
          cx={x(last.date)}
          cy={y(last.value!)}
          r={4}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          className="fill-accent stroke-surface"
        />
      </svg>

      {/* Axis band OUTSIDE the svg, so no label can be clipped by the viewBox. */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-prose-faint">
        <span>{first.slice(5)}</span>
        <span>
          {extent.min}{unit} – {extent.max}{unit}
        </span>
        <span>{last.date.slice(5)}</span>
      </div>

      {/* Two series, so a legend is always present. Text wears text tokens; the
          mark beside it carries the identity. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-prose-faint">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-accent" aria-hidden="true" />
          Logged
          <span className="text-prose">{last.value}{unit}</span>
        </li>
        {targetLine ? (
          <li className="flex items-center gap-1.5">
            <span
              className="h-0 w-4 border-t-2 border-dashed border-prose-faint"
              aria-hidden="true"
            />
            Target
          </li>
        ) : null}
      </ul>
    </div>
  )
}
