type Variant = 'inbody' | 'preview'

interface Props {
  items: string[]
  variant?: Variant
}

/**
 * Key Takeaways block — lives directly below the VerdictCard.
 * Visual hierarchy is intentionally lower than the Verdict Card (no orange
 * tint, smaller eyebrow) so the verdict reads as the primary signal and the
 * takeaways as the supporting detail.
 */
export default function TakeawaysCard({ items, variant = 'inbody' }: Props) {
  if (!items || items.length === 0) return null

  const isPreview = variant === 'preview'
  const containerCls = isPreview
    ? 'rounded-xl border border-soft bg-surface-sunken/60 p-4'
    : 'mb-10 rounded-xl border border-soft bg-surface-sunken/60 p-5 shadow-md shadow-black/5 sm:p-6'
  const eyebrowCls = isPreview
    ? 'mb-3 text-[10px] font-semibold uppercase tracking-widest text-eyebrow'
    : 'mb-4 text-xs font-semibold uppercase tracking-widest text-eyebrow'
  const itemCls = isPreview ? 'text-xs leading-relaxed' : 'text-sm leading-relaxed sm:text-base'
  const dotMt = isPreview ? 'mt-1.5' : 'mt-2 sm:mt-2.5'

  return (
    <section
      className={containerCls}
      aria-label="Key takeaways"
    >
      {/* Real <h2> on the public page for SEO/AI extraction; the workspace
          preview keeps a plain <p> (not a document heading in that context). */}
      {isPreview
        ? <p className={eyebrowCls}>Key Takeaways</p>
        : <h2 className={eyebrowCls}>Key Takeaways</h2>}
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className={`flex items-start gap-3 text-prose ${itemCls}`}>
            <span
              aria-hidden
              className={`block h-2 w-2 shrink-0 rounded-full bg-accent ${dotMt}`}
            />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
