// The one button look. `buttonVariants()` returns the class string so it styles
// any element — <button>, next/link <Link>, a plain <a>, a <label> — without a
// polymorphic wrapper (the shadcn/cva pattern). <Button> is the <button> sugar.
// No class-merging: `className` is for layout (w-full, mt-6, ml-auto, shrink-0),
// never padding/size/colour/radius — pick a `size` / `variant` instead.
//   sm — dense rows, admin toolbars     (36px)
//   md — default                        (44px mobile tap target)
//   lg — hero / page-level CTA          (48px)

const BASE =
  'inline-flex items-center justify-center gap-2 transition-colors ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANT = {
  primary:   'bg-accent hover:bg-accent-hover text-white',
  secondary: 'bg-surface-raised hover:bg-surface border border-soft text-prose-muted hover:text-prose',
  ghost:     'text-prose-muted hover:text-prose hover:bg-surface-raised',
  danger:    'bg-danger-bg hover:bg-danger-bg/80 border border-danger-line text-danger-ink',
} as const

const SIZE = {
  sm: 'text-xs font-semibold px-3 py-1.5 min-h-[36px] rounded-lg',
  md: 'text-sm font-semibold px-5 py-2.5 min-h-[44px] rounded-xl',
  lg: 'text-sm font-bold px-7 py-3.5 min-h-[48px] rounded-xl',
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
