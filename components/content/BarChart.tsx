interface Row { label: string; value: number }

interface Props {
  title: string
  unit: string | null
  rows: Row[]
  /** The stored list markup — rendered for screen readers (the table view). */
  listHtml: string
}

const W = 600          // viewBox width; the SVG scales to the measure
const LABEL_W = 170    // left column for labels
const VALUE_W = 80     // right column for the direct value label
const BAR_H = 14       // thin marks
const ROW_H = 28       // 2px+ surface gap between adjacent bars
const PAD_TOP = 4

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/**
 * Single-series horizontal bar chart, server-rendered SVG, no chart library
 * (docs/rich-elements-plan.md §4 + the dataviz method: one series so no
 * categorical palette; thin ink bars on a recessive track; values and labels in
 * text tokens, never the mark colour; native <title> hover per bar; the list
 * stays in the DOM as the accessible table view). Chrome-black bars — orange
 * fills stay out of the article lane (brand-guide §10.1).
 */
export default function BarChart({ title, unit, rows, listHtml }: Props) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 0)
  const plotW = W - LABEL_W - VALUE_W
  const height = PAD_TOP * 2 + rows.length * ROW_H
  const label = (v: number) => `${fmt.format(v)}${unit ? ` ${unit}` : ''}`

  return (
    <div className="bd-chart" data-title={title}>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        role="img"
        aria-label={`${title}${unit ? ` (${unit})` : ''}: ${rows.map((r) => `${r.label} ${label(r.value)}`).join(', ')}`}
        style={{ display: 'block', fontFamily: 'inherit' }}
      >
        {rows.map((r, i) => {
          const y = PAD_TOP + i * ROW_H
          const w = max > 0 ? Math.max(2, (Math.abs(r.value) / max) * plotW) : 2
          return (
            <g key={i}>
              <title>{`${r.label}: ${label(r.value)}`}</title>
              <text x={LABEL_W - 10} y={y + BAR_H - 2} textAnchor="end" fontSize="13" fill="var(--bd-prose-body)">
                {r.label.length > 24 ? `${r.label.slice(0, 23)}…` : r.label}
              </text>
              <rect x={LABEL_W} y={y} width={plotW} height={BAR_H} fill="var(--bd-border)" />
              <rect x={LABEL_W} y={y} width={w} height={BAR_H} rx="2" fill="var(--bd-text)" />
              <text x={LABEL_W + w + 8} y={y + BAR_H - 2} fontSize="13" fontWeight="600" fill="var(--bd-text)">
                {label(r.value)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="sr-only" dangerouslySetInnerHTML={{ __html: listHtml }} />
    </div>
  )
}
