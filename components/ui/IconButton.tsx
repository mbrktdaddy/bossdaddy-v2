// The one icon-only control — bell, cart, search, hamburger, thread options,
// lightbox arrows, share rows. Every one of those was hand-rolled at 32–40px
// with its own hover; the phone needs 44px (brand-guide §11) and a screen
// reader needs a name, so `label` is required and becomes `aria-label`.
//   chrome  — ghost on whatever it sits on; the role tokens invert inside dark
//             zones, so the same tone works in the masthead and on the page
//   overlay — a scrim chip for controls floating over photos (lightbox,
//             gallery); white on 60% chrome reads on any image
// `relative` is built in so a <CountBadge> can be positioned against it.
// ref is a plain prop (React 19) — pass a disclosure's `triggerProps` straight in.

const TONE = {
  chrome:  'text-prose-muted hover:text-prose hover:bg-surface-hover',
  overlay: 'bg-chrome/60 text-white hover:bg-chrome/80',
} as const

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible name — the icon carries no text. */
  label: string
  tone?: keyof typeof TONE
  ref?: React.Ref<HTMLButtonElement>
}

export function IconButton({ label, tone = 'chrome', type = 'button', className = '', children, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`relative inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${TONE[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
