// The one button look. `buttonVariants()` returns the class string so it styles
// any element — <button>, next/link <Link>, a plain <a>, a <label> — without a
// polymorphic wrapper (the shadcn/cva pattern). <Button> is the <button> sugar.
// No class-merging: `className` is for layout (w-full, mt-6, ml-auto, shrink-0),
// never padding/size/colour/radius — pick a `size` / `variant` instead.
//   sm — dense rows, admin toolbars     (36px)
//   md — default                        (44px mobile tap target)
//   lg — hero / page-level CTA          (48px — py-3 + the 2px edge)
//
// Hard Goods (2026-10-14, brand-guide §6/§10): buttons are Montserrat, UPPERCASE,
// tracked, square (the global radius scale is 4px). The label is a stamp, not a
// sentence — DeWalt / STIHL, not a SaaS pill.
//
// EVERY VARIANT CARRIES A 2px BORDER (continuity plan P14) — `border-2` lives in
// BASE and each variant only picks its colour (`border-transparent` where it
// has no visible edge). Before, outline/success had 2px and primary had none,
// so "Add to cart" → "Added" (primary → success) grew the button 4px and shoved
// the row below it. Swapping variants must never change geometry.

const BASE =
  'inline-flex items-center justify-center gap-2 transition-colors border-2 ' +
  'font-display uppercase tracking-[0.08em] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANT = {
  // `cta` tokens, not `accent`: black with orange hover on the light canvas,
  // hot-orange fill inside dark zones (app/globals.css). Only consumer.
  primary:   'bg-cta hover:bg-cta-hover text-cta-ink border-transparent',
  // The Hard Goods outline — 2px in the text colour, inverts on hover. Reads
  // black-on-white on the page and white-on-black inside a dark zone because
  // it borrows the prose/surface pair (the sanctioned inversion recipe).
  outline:   'bg-transparent border-prose text-prose hover:bg-prose hover:text-surface',
  // The primary button when it sits ON an orange block (newsletter, the brand
  // band): black at rest, inverts to white on hover — `primary` would hover to
  // orange and vanish into the block. Light-page blocks only (never in a zone).
  onBlock:   'bg-chrome text-white hover:bg-surface hover:text-prose border-transparent',
  // A confirmation state ("Added to cart") — the success token recipe, which
  // inverts correctly inside dark zones. Not a call to action; no hover change.
  success:   'bg-success-bg text-success-ink border-success-line',
  secondary: 'bg-surface-raised hover:bg-surface border-soft text-prose-muted hover:text-prose',
  ghost:     'text-prose-muted hover:text-prose hover:bg-surface-raised border-transparent',
  danger:    'bg-danger-bg hover:bg-danger-bg/80 border-danger-line text-danger-ink',
} as const

const SIZE = {
  sm: 'text-[11px] font-extrabold px-3.5 py-1.5 min-h-[36px] rounded-lg',
  md: 'text-[13px] font-extrabold px-5 py-2.5 min-h-[44px] rounded-xl',
  lg: 'text-sm font-extrabold px-7 py-3 min-h-[48px] rounded-xl',
} as const

export type ButtonVariant = keyof typeof VARIANT
export type ButtonSize = keyof typeof SIZE

export function buttonVariants({
  variant = 'primary',
  size = 'md',
  className = '',
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]}${className ? ` ${className}` : ''}`
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonVariants({ variant, size, className })} {...props} />
}
