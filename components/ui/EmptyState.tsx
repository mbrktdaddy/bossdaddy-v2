interface EmptyStateProps {
  title: string
  body?: string
  action?: React.ReactNode
  variant?: 'dashed' | 'subtle'
}

export function EmptyState({ title, body, action, variant = 'subtle' }: EmptyStateProps) {
  const base = variant === 'dashed'
    ? 'border border-dashed border-gray-800'
    : 'bg-gray-900/40'
  return (
    <div className={`text-center py-24 rounded-2xl ${base}`}>
      <p className="text-gray-400 text-lg font-semibold mb-2">{title}</p>
      {body && <p className="text-gray-600 text-sm">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
