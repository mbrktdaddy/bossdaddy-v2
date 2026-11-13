import { Eyebrow } from '@/components/ui/Eyebrow'

interface Props {
  /** The TL;DR — two sentences that open the card. */
  lede?: string | null
  /** The key takeaways, one line each. */
  items?: string[] | null
  className?: string
}

/**
 * The guide's one summary block (2026-11-13): the Quick Take lede and the Key
 * Takeaways in ONE card instead of two stacked boxes. On a phone the two cards
 * plus the open table of contents put the body about two and a half screens
 * down, and the paragraph and the bullets said the same thing twice. The
 * accent-tint treatment is the Quick Take's; the bullets keep their own
 * sub-heading so search and extraction still find "Key Takeaways". Sits ABOVE
 * the .bd-content wrapper so neither heading leaks into the table of contents.
 * Reviews keep VerdictCard + TakeawaysCard: the verdict carries the score and
 * the buy button, so it earns its own block.
 */
export default function QuickTakeCard({ lede, items, className = 'mb-10' }: Props) {
  const text = lede?.trim() ?? ''
  const list = (items ?? []).map((i) => i.trim()).filter(Boolean)
  if (!text && list.length === 0) return null

  return (
    <section
      aria-label={text ? 'Quick take' : 'Key takeaways'}
      className={`${className} bg-accent-tint border border-accent-border/40 rounded-xl p-5 sm:p-6`}
    >
      <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
      <Eyebrow as="h2" className="mb-3">{text ? 'Quick Take' : 'Key Takeaways'}</Eyebrow>
      {text && <p className="text-prose leading-relaxed text-sm sm:text-base">{text}</p>}
      {text && list.length > 0 && (
        <h3 className="mt-5 mb-3 text-[10px] font-semibold uppercase tracking-widest text-eyebrow">Key Takeaways</h3>
      )}
      {list.length > 0 && (
        <ul className="space-y-2.5">
          {list.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-prose text-sm leading-relaxed sm:text-base">
              <span aria-hidden className="block h-2 w-2 shrink-0 rounded-full bg-accent mt-2 sm:mt-2.5" />
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
