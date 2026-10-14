import Link from 'next/link'
import { buttonVariants } from '@/components/ui/Button'

// The one tool tile (continuity plan P12) — the homepage Tools section, the
// /tools hub, the calculator shelf. There were four treatments; this is the
// homepage one (BossToolsSection), which is what the approved mockup ran.
//   tone panel — a BLACK tile: a `data-theme="dark"` zone with the 4px orange
//                top rule and the hot-orange button. Utility-lane black is
//                capped per screen (brand-guide §10.1 "Blocks"), so panels
//                are for the main spokes only.
//   tone box   — the 2px chrome box on the white page, for everything past
//                the first few (the calculators): same anatomy, no block.
//   size full    — kicker, title, blurb, button
//   size compact — kicker, title, one-line blurb; the whole tile is the link
// The kicker names the tool's ROLE ("Money · Loan Math") — build it from
// LABELS at the call site (`${spokeRole} · ${short}`), never a literal.

interface ToolCardProps {
  href: string
  kicker: string
  title: string
  blurb?: string
  /** Button text (full size only). */
  cta?: string
  size?: 'full' | 'compact'
  tone?: 'panel' | 'box'
  className?: string
}

export function ToolCard({ href, kicker, title, blurb, cta = 'Try it', size = 'full', tone = 'panel', className = '' }: ToolCardProps) {
  const panel = tone === 'panel'
  const full = size === 'full'
  return (
    <Link
      href={href}
      data-theme={panel ? 'dark' : undefined}
      className={`group flex flex-col rounded-xl ${full ? 'p-5 sm:p-6' : 'p-4 sm:p-5'} ${
        panel ? 'bg-chrome text-prose border-t-4 border-accent' : 'bg-surface border-2 border-chrome'
      } ${className}`}
    >
      <p className={`font-display font-extrabold text-[11px] uppercase tracking-[0.16em] ${panel ? 'text-accent-text' : 'text-eyebrow'}`}>
        {kicker}
      </p>
      <h3
        className={`mt-2.5 text-prose leading-[1.1] transition-colors ${
          full ? 'text-[21px] font-black tracking-[-0.02em]' : 'text-lg font-extrabold'
        } ${panel ? 'group-hover:text-accent-text' : 'group-hover:text-accent'}`}
      >
        {title}
      </h3>
      {blurb && (
        <p className={`text-prose-faint text-sm ${full ? 'mt-2.5 flex-1' : 'mt-1.5 line-clamp-2'}`}>{blurb}</p>
      )}
      {/* A styled span, not a nested control — the whole tile is the link. */}
      {full && (
        <span className={buttonVariants({ variant: panel ? 'primary' : 'outline', size: 'sm', className: 'self-start mt-5' })}>
          {cta}
        </span>
      )}
    </Link>
  )
}
