import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup'

// The newsletter capture at the end of reviews, guides and About — a thin
// preset over <NewsletterSignup variant="block" inset>, the homepage's ORANGE
// block in its column-width form (2026-11-13, Phase 3: the detail pages had
// the same component as a white 2px box, and no orange moment at all). Kept
// so those three pages didn't churn. Only the eyebrow (and optionally the heading) varies by context; the
// promise and the cadence line come from LABELS.newsletter and never vary.
//
// CAPTURE_CARD re-exported for the remaining hand-built captures (merch
// launch); continuity Phase 4 moves them onto NewsletterSignup and retires it.
export { CAPTURE_CARD } from '@/components/newsletter/styles'

export function NewsletterCard({
  eyebrow,
  heading,
  headingAs = 'h3',
  interests,
  className = '',
}: {
  eyebrow: string
  heading?: string
  headingAs?: 'h2' | 'h3'
  /** Extra digest tags beyond `newsletter` (e.g. `review_alerts`). */
  interests?: string[]
  className?: string
}) {
  return (
    <NewsletterSignup
      variant="block"
      inset
      eyebrow={eyebrow}
      heading={heading}
      headingAs={headingAs}
      interests={interests}
      className={className}
    />
  )
}
