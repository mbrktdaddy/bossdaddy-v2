// The one "nothing here yet" block. Pick the variant by context, not taste:
//   subtle — public listing/search pages (quiet tint + hairline)
//   dashed — author/member surfaces where the empty state invites creation
//   panel  — admin/dashboard lists that normally render inside a surface panel
// size="md" for empty states nested inside a section; "lg" for page-level.

interface EmptyStateProps {
  title: React.ReactNode
  /** Decorative icon above the title — size it at the call site (w-8 h-8 … w-10 h-10). */
  icon?: React.ReactNode
  body?: React.ReactNode
  action?: React.ReactNode
  variant?: 'subtle' | 'dashed' | 'panel'
  size?: 'md' | 'lg'
  className?: string
}

const VARIANT = {
  subtle: 'bg-surface/40 border border-soft',
  dashed: 'border border-dashed border-soft',
  panel:  'bg-surface border border-soft',
} as const

export function EmptyState({ title, icon, body, action, variant = 'subtle', size = 'lg', className = '' }: EmptyStateProps) {
  const lg = size === 'lg'
  return (
    <div className={`text-center rounded-xl px-6 ${lg ? 'py-24' : 'py-10'} ${VARIANT[variant]} ${className}`}>
      {icon && <div className="flex justify-center mb-4" aria-hidden>{icon}</div>}
      <p className={`text-prose-muted font-semibold ${lg ? 'text-lg' : 'text-base'}`}>{title}</p>
      {body && <p className="text-prose-faint text-sm mt-2">{body}</p>}
      {action && <div className={lg ? 'mt-6' : 'mt-4'}>{action}</div>}
    </div>
  )
}
