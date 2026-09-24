import { EmailSignup } from '@/components/EmailSignup'

// The one newsletter signup card — reviews, guides, About. Only the eyebrow
// (and optionally the heading) varies by context; the promise and the button
// never do. The cadence line must match the digest cron in vercel.json
// (weekly, Tuesday, skipped when nothing is new) — don't promise a day or a
// frequency that isn't true.
//
// "Notify me" captures (empty gift guides, merch launch) make a different
// promise and keep their own copy — reuse CAPTURE_CARD for their shell.

export const CAPTURE_CARD = 'bg-surface-raised border-t-[3px] border-accent rounded-xl p-6 sm:p-8'

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
      <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3 mx-auto" />
      <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">{eyebrow}</p>
      <Heading className="text-xl font-black text-prose mb-2">{heading}</Heading>
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
