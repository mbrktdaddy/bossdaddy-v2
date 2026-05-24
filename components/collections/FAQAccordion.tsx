'use client'

import { useState } from 'react'
import type { FAQ } from '@/lib/seo/faq-ld'

export type { FAQ }

interface Props {
  faqs: FAQ[]
  /** Section anchor id — referenced by ArticleTOC. */
  id?: string
  /** Heading override. Defaults to "Frequently Asked Questions". */
  heading?: string
}

/**
 * Accordion-style FAQ. Parent server component should emit FAQPage JSON-LD
 * separately via `faqPageLd` from `@/lib/seo/faq-ld`.
 */
export default function FAQAccordion({ faqs, id = 'faq', heading = 'Frequently Asked Questions' }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  if (!faqs || faqs.length === 0) return null

  return (
    <section id={id} aria-label={heading} className="mb-12">
      <div className="mb-5">
        <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">FAQ</p>
        <h2 className="text-2xl font-black text-prose leading-tight">{heading}</h2>
      </div>

      <div className="space-y-2">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx
          return (
            <div
              key={`${idx}-${faq.question.slice(0, 30)}`}
              className={`bg-gradient-to-br from-surface to-surface/60 border ring-1 ring-inset ring-stone-900/[0.04] rounded-xl overflow-hidden transition-colors ${
                isOpen ? 'border-accent-border/40' : 'border-soft hover:border-strong'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left min-h-[56px]"
              >
                <span className={`text-sm sm:text-base font-bold leading-snug ${isOpen ? 'text-prose' : 'text-prose'}`}>
                  {faq.question}
                </span>
                <svg
                  className={`w-4 h-4 shrink-0 text-accent-text-soft transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 -mt-1 text-sm sm:text-base text-prose-muted leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

