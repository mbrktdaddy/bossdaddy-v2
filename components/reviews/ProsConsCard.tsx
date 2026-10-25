import { CheckIcon, XIcon } from '@/components/icons'

interface Props {
  pros: string[]
  cons: string[]
}

/**
 * Pros & cons — lives under the Key Takeaways on a review. Until 2026-10-25 the
 * columns were selected but only emitted as schema.org ItemLists, never shown.
 * Same quiet register as TakeawaysCard: hairline card, ink-only icons, no
 * tinted wash (Hard Goods: fills never inside the article lane).
 */
export default function ProsConsCard({ pros, cons }: Props) {
  if (!pros.length && !cons.length) return null
  return (
    <section className="mb-10 rounded-xl border border-soft bg-surface-sunken/60 p-5 sm:p-6" aria-label="Pros and cons">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {pros.length > 0 && (
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-eyebrow">What works</h2>
            <ul className="space-y-2.5">
              {pros.map((p, i) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-prose sm:text-base">
                  <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-forest" strokeWidth={2.5} aria-hidden />
                  <span className="min-w-0">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {cons.length > 0 && (
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-eyebrow">Watch outs</h2>
            <ul className="space-y-2.5">
              {cons.map((c, i) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-prose sm:text-base">
                  <XIcon className="mt-1 h-4 w-4 shrink-0 text-danger-ink" strokeWidth={2.5} aria-hidden />
                  <span className="min-w-0">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
