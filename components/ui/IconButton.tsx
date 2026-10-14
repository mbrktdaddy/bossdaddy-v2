// The one icon-only control — bell, cart, search, hamburger, thread options,
// lightbox arrows, share rows. Every one of those was hand-rolled at 32–40px
// with its own hover; the phone needs 44px (brand-guide §11) and a screen
// reader needs a name, so `label` is required and becomes `aria-label`.
//   chrome  — ghost on whatever it sits on; the role tokens invert inside dark
//             zones, so the same tone works in the masthead and on the page
//   overlay — a scrim chip for controls floating over photos (lightbox,
//             gallery); white on 60% chrome reads on any image
//   outline — the Hard Goods stamp (share rows): 2px edge in the text colour,
//             inverts on hover — the outline button's pair, one size down
//   inverted — outline's "on" state (Copied): same 2px edge, filled, so the
//             swap changes colour only, never the box
// `relative` is built in so a <CountBadge> can be positioned against it.
// ref is a plain prop (React 19) — pass a disclosure's `triggerProps` straight in.

const TONE = {
  chrome:  'text-prose-muted hover:text-prose hover:bg-surface-hover',
  overlay: 'bg-chrome/60 text-white hover:bg-chrome/80',
  outline: 'border-2 border-prose text-prose hover:bg-prose hover:text-surface',
  inverted: 'border-2 border-prose bg-prose text-surface',
} as const

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible name — the icon carries no text. */
  label: string
  tone?: keyof typeof TONE
  ref?: React.Ref<HTMLButtonElement>
}

/** The recipe as a string, for an icon-only LINK (the cart) — pair with `aria-label`. */
export function iconButtonClass({ tone = 'chrome', className = '' }: { tone?: keyof typeof TONE; className?: string } = {}) {
  return `relative inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${TONE[tone]}${className ? ` ${className}` : ''}`
}

export function IconButton({ label, tone = 'chrome', type = 'button', className = '', children, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={iconButtonClass({ tone, className })}
      {...props}
    >
      {children}
    </button>
  )
}
