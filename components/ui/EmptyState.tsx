interface EmptyStateProps {
  title: string
  body?: string
  action?: React.ReactNode
  variant?: 'dashed' | 'subtle'
}

export function EmptyState({ title, body, action, variant = 'subtle' }: EmptyStateProps) {
  const base = variant === 'dashed'
    ? 'border border-dashed border-soft'
    : 'bg-surface/40'
  return (
    <div className={`text-center py-24 rounded-2xl ${base}`}>
      <p className="text-prose-muted text-lg font-semibold mb-2">{title}</p>
      {body && <p className="text-prose-faint text-sm">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
