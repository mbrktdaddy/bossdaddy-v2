import Link from 'next/link'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Card } from '@/components/ui/Card'
import { buttonVariants } from '@/components/ui/Button'

// Inline "Ask the Boss" entry point. Deep-links into /tools/the-boss with a
// context seed so the Boss opens primed for the page the dad is on. The page
// reads ?context= and feeds it into the first turn.
// The Boss can't read site content (no tools), so entry prompts never promise a
// tested pick — the context is a topic hint, not a lookup.
//
// Two looks. `panel` (the default since 2026-11-13, Phase 3 of the Manifesto
// rollout) is the Tools tile anatomy — a `data-theme="dark"` zone with the 4px
// orange rule, the orange kicker, a white title and the hot-orange button —
// because the Boss IS a tool and the Tools lane is where the black panels live
// (brand-guide §2 "Blocks"). As a chrome box with a small icon it read as a
// form field, and a detail page had no dark moment at all. `card` keeps the
// box for a surface that already has its black panel beside it.
export default function AskTheBoss({
  context,
  prompt = 'Got a question? Tell the Boss what you need — get a straight answer.',
  variant = 'panel',
  className = '',
}: {
  context?: string
  prompt?: string
  variant?: 'panel' | 'card'
  className?: string
}) {
  const href = context ? `/tools/the-boss?context=${encodeURIComponent(context)}` : '/tools/the-boss'

  if (variant === 'card') {
    return (
      <Card tone="chrome" className={className}>
        <Link href={href} className="group flex items-center gap-4 p-4 sm:p-5">
          <span className="shrink-0 grid place-items-center w-10 h-10 rounded-md bg-accent text-white" aria-hidden>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12a8 8 0 01-8 8H7l-4 3v-7a8 8 0 018-8h2a8 8 0 018 8z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <Eyebrow>Ask the Boss</Eyebrow>
            <p className="text-sm sm:text-base font-bold text-prose group-hover:text-accent transition-colors leading-snug">
              {prompt}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-accent inline-flex items-center gap-1">
            Ask <span aria-hidden>→</span>
          </span>
        </Link>
      </Card>
    )
  }

  return (
    <section
      data-theme="dark"
      aria-label="Ask the Boss"
      className={`bg-chrome text-prose border-t-4 border-accent rounded-xl px-6 py-7 md:px-8 md:py-8 ${className}`}
    >
      <p className="text-xs uppercase tracking-widest font-semibold text-accent-text">Ask the Boss</p>
      <p className="mt-2 font-display font-black text-xl md:text-2xl leading-tight tracking-tight text-prose max-w-[36ch]">
        {prompt}
      </p>
      <p className="mt-2 text-sm text-prose-muted max-w-[46ch]">
        {context ? 'A straight answer from the Boss, primed for this page.' : 'A straight answer from the Boss.'}
      </p>
      <Link href={href} className={`${buttonVariants({ variant: 'primary' })} mt-5`}>
        Ask the Boss
      </Link>
    </section>
  )
}
