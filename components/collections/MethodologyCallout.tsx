import { getCategoryBySlug } from '@/lib/categories'

interface Props {
  /** Category slug — pulls the canonical `pov` paragraph from lib/categories. */
  categorySlug?: string | null
  /** Optional override — sanitized HTML from a per-collection methodology field. */
  overrideHtml?: string | null
  /** Optional override paragraph — used when html isn't present. */
  overrideText?: string | null
  /** Section anchor id — referenced by ArticleTOC. */
  id?: string
  /** Eyebrow text. Defaults to "How I Tested"; gift guides pass "How I Pick Gifts". */
  eyebrowLabel?: string
}

/**
 * "How I Tested" callout — credibility signal that distinguishes editorial
 * content from generic listicles. Wirecutter / Strategist / Consumer
 * Reports all surface methodology prominently. By default we pull the
 * category's `pov` from `lib/categories.ts` (which already encodes the
 * voice + testing approach per vertical). Collections can override with
 * a custom paragraph when they need specifics.
 *
 * Renders null if no source content is available — better to omit than
 * to surface an empty "How I Tested" with nothing inside it.
 */
export default function MethodologyCallout({
  categorySlug,
  overrideHtml,
  overrideText,
  id = 'how-i-tested',
  eyebrowLabel = 'How I Tested',
}: Props) {
  const html = overrideHtml?.trim() || null
  const text = overrideText?.trim() || (categorySlug ? getCategoryBySlug(categorySlug)?.pov ?? null : null)

  if (!html && !text) return null

  return (
    <section
      id={id}
      aria-label={eyebrowLabel}
      className="mb-12 rounded-2xl border border-accent-border/30 bg-gradient-to-br from-accent-tint to-white ring-1 ring-inset ring-stone-900/[0.04] shadow-md shadow-stone-900/[0.05]"
    >
      <div className="flex items-start gap-4 p-5 sm:p-6">
        {/* Editorial seal icon */}
        <div className="hidden sm:flex shrink-0 w-12 h-12 rounded-full bg-accent/15 border border-accent-border/40 items-center justify-center">
          <svg className="w-6 h-6 text-accent-text-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-2" />
          <p className="text-xs text-eyebrow uppercase tracking-widest font-bold mb-2">{eyebrowLabel}</p>
          {html ? (
            <div
              className="prose prose-orange max-w-none prose-p:text-prose-muted prose-p:leading-relaxed prose-p:text-sm sm:prose-p:text-base prose-p:my-0 prose-p:mb-3 last:prose-p:mb-0"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            // whitespace-pre-line preserves paragraph breaks editors type into
            // the workspace textarea — without it, multi-paragraph methodology
            // collapses into one wall of text.
            <p className="text-sm sm:text-base text-prose-muted leading-relaxed whitespace-pre-line">{text}</p>
          )}
        </div>
      </div>
    </section>
  )
}
