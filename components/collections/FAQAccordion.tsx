'use client'

import { useState } from 'react'

export interface FAQ {
  question: string
  answer:   string
}

interface Props {
  faqs: FAQ[]
  /** Section anchor id — referenced by ArticleTOC. */
  id?: string
  /** Heading override. Defaults to "Frequently Asked Questions". */
  heading?: string
}

/**
 * Accordion-style FAQ with native <details>/<summary> for accessibility
 * and graceful no-JS behavior. Designed to sit at the bottom of long
 * collection / review / guide pages. Parent should emit FAQPage JSON-LD
 * separately (see `faqPageLd` helper below) so the schema can be
 * generated server-side from the same data.
 */
export default function FAQAccordion({ faqs, id = 'faq', heading = 'Frequently Asked Questions' }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  if (!faqs || faqs.length === 0) return null

  return (
    <section id={id} aria-label={heading} className="mb-12">
      <div className="mb-5">
        <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
        <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">FAQ</p>
        <h2 className="text-2xl font-black text-white leading-tight">{heading}</h2>
      </div>

      <div className="space-y-2">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx
          return (
            <div
              key={`${idx}-${faq.question.slice(0, 30)}`}
              className={`bg-gradient-to-br from-gray-900 to-gray-900/60 border ring-1 ring-inset ring-white/[0.02] rounded-2xl overflow-hidden transition-colors ${
                isOpen ? 'border-orange-900/40' : 'border-gray-800/60 hover:border-gray-700'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left min-h-[56px]"
              >
                <span className={`text-sm sm:text-base font-bold leading-snug ${isOpen ? 'text-white' : 'text-gray-200'}`}>
                  {faq.question}
                </span>
                <svg
                  className={`w-4 h-4 shrink-0 text-orange-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
                <div className="px-5 pb-5 -mt-1 text-sm sm:text-base text-gray-400 leading-relaxed">
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

/**
 * Build the FAQPage JSON-LD payload from the same array. Call this in the
 * parent server component and emit alongside the page's other schema so
 * the FAQs become rich-result eligible.
 */
export function faqPageLd(faqs: FAQ[]) {
  if (!faqs || faqs.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type':          'Question',
      name:             f.question,
      acceptedAnswer:   { '@type': 'Answer', text: f.answer },
    })),
  }
}
