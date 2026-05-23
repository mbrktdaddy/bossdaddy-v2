import Link from 'next/link'
import type { ReviewTimelineNode, VerdictChange } from '@/lib/reviews'

interface Props {
  nodes: ReviewTimelineNode[]
  activeId: string
}

function verdictIcon(v: VerdictChange | null): string | null {
  switch (v) {
    case 'improved':           return '↑'
    case 'declined':           return '↓'
    case 'complete_reversal':  return '↓↓'
    case 'unchanged':          return '→'
    default:                   return null
  }
}

function verdictAriaLabel(v: VerdictChange | null): string {
  switch (v) {
    case 'improved':           return 'Verdict improved'
    case 'declined':           return 'Verdict declined'
    case 'complete_reversal':  return 'Verdict reversed'
    case 'unchanged':          return 'Verdict unchanged'
    default:                   return ''
  }
}

function nodeLabel(node: ReviewTimelineNode): string {
  if (node.is_parent) return 'Initial'
  return node.milestone_label ?? 'Update'
}

// Renders nothing when there's only the parent — a strip of one is just a dot.
// Designed to fit ~5 nodes on a 320px mobile screen via compact sizing.
export function ReviewTimelineStrip({ nodes, activeId }: Props) {
  if (nodes.length <= 1) return null

  return (
    <nav
      aria-label="Review timeline"
      className="mb-6 -mx-6 px-6 sm:mx-0 sm:px-0"
    >
      <ol className="flex items-stretch gap-1 sm:gap-2 overflow-x-auto scrollbar-hide pb-2">
        {nodes.map((node, i) => {
          const active = node.id === activeId
          const icon = verdictIcon(node.verdict_change)
          const ratingStr = node.rating != null ? Number(node.rating).toFixed(1) : '—'

          const inner = (
            <div
              className={`flex flex-col items-center justify-center min-w-[88px] sm:min-w-[104px] px-3 py-2 rounded-xl border transition-colors ${
                active
                  ? 'bg-accent-tint border-accent text-prose'
                  : 'bg-surface border-strong text-prose-muted hover:bg-surface-raised hover:border-accent-border/60'
              }`}
            >
              <span className={`text-[10px] uppercase tracking-widest font-semibold leading-none mb-1 ${active ? 'text-accent-text' : 'text-prose-faint'}`}>
                {nodeLabel(node)}
              </span>
              <span className="flex items-baseline gap-1">
                <span className="text-sm font-black tabular-nums">{ratingStr}</span>
                <span className="text-[10px] text-prose-faint">/10</span>
              </span>
              {icon && (
                <span
                  className="text-xs mt-0.5 leading-none"
                  aria-label={verdictAriaLabel(node.verdict_change)}
                >
                  {icon}
                </span>
              )}
            </div>
          )

          return (
            <li key={node.id} className="flex items-center shrink-0">
              {active || !node.slug ? (
                <span aria-current={active ? 'page' : undefined}>{inner}</span>
              ) : (
                <Link href={`/reviews/${node.slug}`}>{inner}</Link>
              )}
              {i < nodes.length - 1 && (
                <span
                  aria-hidden
                  className="block w-4 sm:w-6 h-px bg-soft mx-0.5 sm:mx-1 shrink-0"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
