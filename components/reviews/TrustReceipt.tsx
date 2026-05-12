interface Props {
  pricePaidCents?: number | null
  testingDuration?: string | null
  className?: string
}

const TESTING_DURATION_LABEL: Record<string, string> = {
  '<1wk':   '<1 week',
  '1-4wks': '1–4 weeks',
  '1-3mo':  '1–3 months',
  '3+mo':   '3+ months',
}

/**
 * Inline trust-signal line that sits under the author byline.
 * Shows what the author paid + how long they tested — both are differentiating
 * honesty signals most review sites can't make. Renders nothing if both fields
 * are empty so old reviews don't get a half-empty receipt.
 */
export default function TrustReceipt({ pricePaidCents, testingDuration, className = '' }: Props) {
  const hasPrice = pricePaidCents != null && pricePaidCents > 0
  const durationLabel = testingDuration ? TESTING_DURATION_LABEL[testingDuration] ?? testingDuration : null
  if (!hasPrice && !durationLabel) return null

  return (
    <p className={`text-xs text-gray-400 sm:text-sm ${className}`}>
      {hasPrice && (
        <span className="whitespace-nowrap">
          <span aria-hidden className="text-orange-500">💵</span>{' '}
          Paid ${(pricePaidCents! / 100).toFixed(2)}
        </span>
      )}
      {hasPrice && durationLabel && (
        <span aria-hidden className="mx-2 text-gray-700">·</span>
      )}
      {durationLabel && (
        <span className="whitespace-nowrap">
          <span aria-hidden className="text-orange-500">⏱</span>{' '}
          Tested {durationLabel}
        </span>
      )}
    </p>
  )
}
