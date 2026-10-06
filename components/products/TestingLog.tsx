import { ChevronDownIcon } from '@/components/icons'
import { LABELS } from '@/lib/labels'
import { formatNoteDate, type TestingNoteWithWeek } from '@/lib/products/testing-notes'

interface Props {
  /** Newest first, numbered (withWeeks). */
  notes: TestingNoteWithWeek[]
  /** A closed <details> (the review page, where the verdict leads) instead of
   *  an open section (the Bench page, where the log IS the news). Script-free. */
  collapsible?: boolean
  className?: string
}

/**
 * A product's dated testing notes ("Week 2: battery's holding up"). Shown on
 * /bench/[slug] while it's tested, and on the review once it's reviewed, since
 * /bench/<slug> 307s to the review from then on and would otherwise hide them.
 * Both render `#testing-log`, so a link can jump straight to it.
 */
export function TestingLog({ notes, collapsible = false, className = '' }: Props) {
  if (notes.length === 0) return null

  const list = (
    <ol className="space-y-4">
      {notes.map((n) => (
        <li key={n.id} className="border-l-2 border-accent-border/50 pl-4">
          <p className="text-xs text-prose-faint">
            <span className="font-bold text-prose-muted">Week {n.week}</span>
            <span className="mx-2">·</span>
            <time dateTime={n.noted_on}>{formatNoteDate(n.noted_on)}</time>
          </p>
          <p className="mt-1 text-sm text-prose leading-relaxed whitespace-pre-line">{n.body}</p>
        </li>
      ))}
    </ol>
  )

  if (collapsible) {
    return (
      <details id="testing-log" className={`group rounded-xl border border-soft bg-surface ${className}`}>
        <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-4 py-3 min-h-[44px]">
          <span className="text-xs font-black uppercase tracking-widest text-prose-muted">{LABELS.testingLog.full}</span>
          <span className="flex items-center gap-2 text-xs text-prose-faint">
            {notes.length} {notes.length === 1 ? 'entry' : 'entries'}
            <ChevronDownIcon className="w-3 h-3 group-open:rotate-180 transition-transform" strokeWidth={2} />
          </span>
        </summary>
        <div className="px-4 pb-4 pt-1">{list}</div>
      </details>
    )
  }

  return (
    <section id="testing-log" className={className} aria-labelledby="testing-log-heading">
      <h2 id="testing-log-heading" className="text-lg font-black mb-4">{LABELS.testingLog.full}</h2>
      {list}
    </section>
  )
}
