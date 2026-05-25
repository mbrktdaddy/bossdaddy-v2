const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:    { label: 'Draft',     className: 'bg-surface-raised text-prose-muted border-strong' },
  pending:  { label: 'Pending',   className: 'bg-amber-50 text-amber-700 border-amber-300' },
  approved: { label: 'Live',      className: 'bg-green-50 text-forest border-green-300' },
  rejected: { label: 'Rejected',  className: 'bg-red-50 text-red-700 border-red-300' },
}

export function StatusBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  const sizing = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
  return (
    <span className={`${sizing} rounded-full font-medium border ${config.className}`}>
      {config.label}
    </span>
  )
}
