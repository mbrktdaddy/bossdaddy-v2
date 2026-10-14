import { EmailSignup } from '@/components/EmailSignup'
import { LabelBlock } from '@/components/ui/LabelBlock'

// The one newsletter signup card — reviews, guides, About. Only the eyebrow
// (and optionally the heading) varies by context; the promise and the button
// never do. The cadence line must match the digest cron in vercel.json
// (weekly, Tuesday, skipped when nothing is new) — don't promise a day or a
// frequency that isn't true.
//
// "Notify me" captures (empty gift guides, merch launch) make a different
// promise and keep their own copy — reuse CAPTURE_CARD for their shell.

export const CAPTURE_CARD = 'bg-surface border-2 border-chrome rounded-xl p-6 sm:p-8'

export function NewsletterCard({
  eyebrow,
  heading = 'Get the next one in your inbox',
  headingAs: Heading = 'h3',
  interests = ['newsletter'],
  className = '',
}: {
  eyebrow: string
  heading?: string
  headingAs?: 'h2' | 'h3'
  interests?: string[]
  className?: string
}) {
  return (
    <div className={`${CAPTURE_CARD} text-center ${className}`}>
      <LabelBlock className="mb-3">{eyebrow}</LabelBlock>
      <Heading className="text-xl font-black uppercase text-prose mb-2">{heading}</Heading>
      <p className="text-sm text-prose-muted mb-5 max-w-md mx-auto">
        One email a week — only when there&apos;s something new. No spam. No sponsors.
      </p>
      <div className="max-w-md mx-auto">
        <EmailSignup
          heading={null}
          description={null}
          buttonLabel="Join Free"
          successMessage="You're in. Welcome to the crew."
          interests={interests}
        />
        <p className="text-xs text-prose-faint mt-3">Unsubscribe anytime.</p>
      </div>
    </div>
  )
}
