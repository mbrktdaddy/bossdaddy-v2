import Link from 'next/link'

// Inline "Ask the Boss" entry point. Deep-links into /tools/the-boss with a
// context seed so the Boss opens primed for the page the dad is on. The page
// reads ?context= and feeds it into the first turn.
// The Boss can't read site content (no tools), so entry prompts never promise a
// tested pick — the context is a topic hint, not a lookup.
export default function AskTheBoss({
  context,
  prompt = 'Got a question? Tell the Boss what you need — get a straight answer.',
  className = '',
}: {
  context?: string
  prompt?: string
  className?: string
}) {
  const href = context ? `/tools/the-boss?context=${encodeURIComponent(context)}` : '/tools/the-boss'
  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 rounded-2xl border border-soft bg-surface hover:border-accent p-4 sm:p-5 transition-colors ${className}`}
    >
      <span className="shrink-0 grid place-items-center w-10 h-10 rounded-full bg-accent/15 text-accent" aria-hidden>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12a8 8 0 01-8 8H7l-4 3v-7a8 8 0 018-8h2a8 8 0 018 8z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">Ask the Boss</p>
        <p className="text-sm sm:text-base font-bold text-prose group-hover:text-accent transition-colors leading-snug">
          {prompt}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-accent inline-flex items-center gap-1">
        Ask <span aria-hidden>→</span>
      </span>
    </Link>
  )
}
