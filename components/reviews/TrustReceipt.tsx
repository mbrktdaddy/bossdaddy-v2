interface Props {
  pricePaidCents?: number | null
  testingDuration?: string | null
  /** Only meaningful when testingDuration === 'custom' — an ISO 'YYYY-MM-DD' start date. */
  testingSince?: string | null
  /** Only meaningful when testingDuration === 'custom' — a free-text duration phrase. */
  testingNote?: string | null
  className?: string
}

const TESTING_DURATION_LABEL: Record<string, string> = {
  '<1wk':   '<1 week',
  '1-4wks': '1–4 weeks',
  '1-3mo':  '1–3 months',
  '3+mo':   '3+ months',
  '6mo':    '6+ months',
  '1yr':    '1+ year',
  '2yr':    '2+ years',
  '3yr':    '3+ years',
  '5yr':    '5+ years',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Format an ISO 'YYYY-MM-DD' date as "Mon YYYY" without a Date object (tz-safe, no render-time clock). */
function formatSince(iso: string): string {
  const [y, m] = iso.split('-')
  const mi = parseInt(m, 10) - 1
  const mon = MONTHS[mi]
  return mon ? `${mon} ${y}` : y
}

/**
 * Inline trust-signal line that sits under the author byline.
 * Shows what the author paid + how long they tested — both are differentiating
 * honesty signals most review sites can't make. Renders nothing if both fields
 * are empty so old reviews don't get a half-empty receipt.
 */
export default function TrustReceipt({ pricePaidCents, testingDuration, testingSince, testingNote, className = '' }: Props) {
  const hasPrice = pricePaidCents != null && pricePaidCents > 0

  // "Tested since Jan 2024" for a custom start date, "Tested 2 summers of camping"
  // for a custom note, otherwise the matching bucket label ("Tested 3+ months").
  let durationPrefix = 'Tested'
  let durationLabel: string | null = null
  if (testingDuration === 'custom') {
    if (testingSince) {
      durationPrefix = 'Tested since'
      durationLabel = formatSince(testingSince)
    } else if (testingNote) {
      durationLabel = testingNote
    }
  } else if (testingDuration) {
    durationLabel = TESTING_DURATION_LABEL[testingDuration] ?? testingDuration
  }

  if (!hasPrice && !durationLabel) return null

  return (
    <p className={`text-xs text-prose-muted sm:text-sm ${className}`}>
      {hasPrice && (
        <span className="whitespace-nowrap">
          <span aria-hidden className="text-accent-text">💵</span>{' '}
          Paid ${(pricePaidCents! / 100).toFixed(2)}
        </span>
      )}
      {hasPrice && durationLabel && (
        <span aria-hidden className="mx-2 text-prose-faint">·</span>
      )}
      {durationLabel && (
        <span className="whitespace-nowrap">
          <span aria-hidden className="text-accent-text">⏱</span>{' '}
          {durationPrefix} {durationLabel}
        </span>
      )}
    </p>
  )
}
