import type { FAQ } from '@/lib/seo/faq-ld'
import { Eyebrow } from '@/components/ui/Eyebrow'

export type { FAQ }

interface Props {
  faqs: FAQ[]
  /** Section anchor id — referenced by ArticleTOC. */
  id?: string
  /** Heading override. Defaults to "Frequently Asked Questions". */
  heading?: string
  className?: string
}

/**
 * Native <details> keeps every answer in the DOM (find-in-page, crawlers) and
 * works without JS. Parent emits FAQPage JSON-LD via `faqPageLd`.
 */
export default function FAQAccordion({
  faqs,
  id = 'faq',
  heading = 'Frequently Asked Questions',
  className = 'mb-12',
}: Props) {
  if (!faqs || faqs.length === 0) return null

  return (
    <section id={id} aria-label={heading} className={className}>
      <div className="mb-4">
        <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
        <Eyebrow className="mb-1">FAQ</Eyebrow>
        <h2 className="text-2xl font-black text-prose leading-tight">{heading}</h2>
      </div>

      <div className="border-y border-soft divide-y divide-soft">
        {faqs.map((faq, idx) => (
          <details key={`${idx}-${faq.question.slice(0, 30)}`} className="group">
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none py-4 min-h-[56px] [&::-webkit-details-marker]:hidden">
              <span className="text-sm sm:text-base font-bold text-prose leading-snug group-hover:text-accent-text-soft transition-colors">
                {faq.question}
              </span>
              <span
                aria-hidden
                className="shrink-0 grid place-items-center w-7 h-7 rounded-full border border-soft text-accent-text-soft transition-transform duration-200 group-open:rotate-45"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </summary>
            <div className="pb-5 pr-11 text-sm sm:text-base text-prose-muted leading-relaxed whitespace-pre-line">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
