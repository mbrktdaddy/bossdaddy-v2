interface Props {
  eyebrow?: string
  heading?: string
  subhead?: string
  /** Defaults to /api/newsletter/subscribe — overridable for re-use in other contexts. */
  action?: string
  buttonLabel?: string
  /** Comma-separated list of interest tags persisted with the subscription. */
  interests?: string
}

export default function EmailCaptureSection({
  eyebrow = 'The Weekly Drop',
  heading = 'Sunday morning. One email.',
  subhead = "New reviews, what I'm testing, and the verdicts about to drop. No PR-speak. Unsubscribe anytime.",
  action = '/api/newsletter/subscribe',
  buttonLabel = 'Subscribe',
  interests = 'newsletter',
}: Props) {
  return (
    <section className="bg-background border-t-[3px] border-accent border-b border-soft">
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">
          {eyebrow}
        </p>
        <h2 className="text-3xl font-black text-prose leading-tight tracking-tight mb-3">
          {heading}
        </h2>
        <p className="text-base text-prose-muted leading-relaxed mb-8 max-w-md mx-auto">
          {subhead}
        </p>
        <form action={action} method="POST" className="flex flex-wrap gap-2 max-w-md mx-auto">
          <input type="hidden" name="interests" value={interests} />
          <label htmlFor="email-capture-input" className="sr-only">Email address</label>
          <input
            id="email-capture-input"
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="flex-1 min-w-0 basis-60 px-4 py-3.5 text-sm bg-surface border border-strong rounded-xl text-prose placeholder:text-prose-faint focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
          />
          <button
            type="submit"
            className="px-6 py-3.5 text-sm font-extrabold text-white bg-accent hover:bg-accent-hover rounded-xl transition-colors"
          >
            {buttonLabel} →
          </button>
        </form>
      </div>
    </section>
  )
}
