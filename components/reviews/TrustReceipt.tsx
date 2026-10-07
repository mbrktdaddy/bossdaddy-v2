import { Fragment, type ReactNode } from 'react'

interface Props {
  pricePaidCents?: number | null
  testingDuration?: string | null
  /** Only meaningful when testingDuration === 'custom' — an ISO 'YYYY-MM-DD' start date. */
  testingSince?: string | null
  /** Only meaningful when testingDuration === 'custom' — a free-text duration phrase. */
  testingNote?: string | null
  /** "Bought it" from the product's How I got it (mig 158). Shown only without a price, which already says it. */
  bought?: boolean
  /** The legally required line for a brand-provided or loaned unit (productClaims). */
  disclosure?: string | null
  /** The exact model tested (products.model_number, mig 159). */
  modelNumber?: string | null
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
 * honesty signals most review sites can't make — and the exact model tested
 * (a tool-only unit and a kit can share a name) — plus, for a brand-provided or
 * loaned unit, the material-connection disclosure, which the FTC wants next to
 * the opinion rather than in a footer. Renders nothing when every field is
 * empty, so old reviews don't get a half-empty receipt.
 */
export default function TrustReceipt({ pricePaidCents, testingDuration, testingSince, testingNote, bought = false, disclosure = null, modelNumber = null, className = '' }: Props) {
  const hasPrice = pricePaidCents != null && pricePaidCents > 0
  const showBought = bought && !hasPrice

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

  const model = modelNumber?.trim() || null

  // Each fact is one segment; dots go between whichever ones are present.
  const segments: { key: string; node: ReactNode }[] = []
  if (hasPrice) {
    segments.push({ key: 'paid', node: (
      <>
        <span aria-hidden className="text-accent-text">💵</span>{' '}
        Paid ${(pricePaidCents! / 100).toFixed(2)}
      </>
    ) })
  }
  if (showBought) segments.push({ key: 'bought', node: 'Bought it' })
  if (durationLabel) {
    segments.push({ key: 'tested', node: (
      <>
        <span aria-hidden className="text-accent-text">⏱</span>{' '}
        {durationPrefix} {durationLabel}
      </>
    ) })
  }
  if (model) segments.push({ key: 'model', node: `Model ${model}` })

  if (segments.length === 0 && !disclosure) return null

  return (
    <div className={className}>
    {segments.length > 0 && (
      <p className="text-xs text-prose-muted sm:text-sm">
        {segments.map((seg, i) => (
          <Fragment key={seg.key}>
            {i > 0 && <span aria-hidden className="mx-2 text-prose-faint">·</span>}
            <span className="whitespace-nowrap">{seg.node}</span>
          </Fragment>
        ))}
      </p>
    )}
    {disclosure && <p className="mt-1.5 text-xs text-prose-faint italic">{disclosure}</p>}
    </div>
  )
}
