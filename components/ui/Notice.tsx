import { IconButton } from './IconButton'
import { XIcon } from '@/components/icons'

// The one banner / toast (continuity plan P17). Five surfaces drew the same
// idea five ways — WelcomeToast, InstallPrompt, InstallPWA, VotePayoffBanner,
// the thread toast. This is the recipe they converged on: a black utility
// panel (a `data-theme="dark"` zone, so the role tokens invert inside it) with
// the 4px orange top rule — the bench strip / tools-tile family, never a
// pastel alert box.
//   banner — in the flow, top of a page or section
//   toast  — fixed, bottom; phones full-width between 12px gutters, sm+ a
//            24rem card at the right. Pass `style={{ bottom }}` to ride above
//            the mobile tab strip (MOBILE_BOTTOM_NAV_OFFSET) — the caller
//            knows whether it's showing
//   inline — in the flow inside content, tighter
// role="status" by default (polite — a notice isn't an emergency). Pass
// `onDismiss` for the X; the caller owns the "don't show again" memory.

const VARIANT = {
  banner: 'p-4 sm:p-5',
  toast:  'fixed inset-x-3 bottom-6 z-50 p-3 sm:inset-x-auto sm:right-6 sm:w-96',
  inline: 'p-3.5',
} as const

interface NoticeProps {
  variant?: keyof typeof VARIANT
  title?: React.ReactNode
  /** The supporting line under the title. */
  children?: React.ReactNode
  /** One button or link — `buttonVariants({ size: 'sm' })`. */
  action?: React.ReactNode
  onDismiss?: () => void
  dismissLabel?: string
  role?: 'status' | 'region' | 'alert'
  /** Accessible name — required when role="region". */
  label?: string
  className?: string
  style?: React.CSSProperties
}

export function Notice({
  variant = 'banner', title, children, action, onDismiss, dismissLabel = 'Dismiss',
  role = 'status', label, className = '', style,
}: NoticeProps) {
  return (
    <div
      data-theme="dark"
      role={role}
      aria-label={label}
      style={style}
      className={`flex items-center gap-3 bg-chrome text-prose border-t-4 border-accent rounded-xl ${VARIANT[variant]} ${className}`}
    >
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-bold text-prose leading-snug">{title}</p>}
        {children && <div className={`text-sm text-prose-muted leading-snug ${title ? 'mt-0.5' : ''}`}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <IconButton label={dismissLabel} onClick={onDismiss} className="-my-1.5 -mr-1.5">
          <XIcon className="w-5 h-5" strokeWidth={2} />
        </IconButton>
      )}
    </div>
  )
}
