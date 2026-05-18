export interface FAQ {
  question: string
  answer:   string
}

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
