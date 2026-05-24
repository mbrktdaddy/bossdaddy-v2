const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:    { label: 'Draft',     className: 'bg-surface-raised text-prose-muted border-strong' },
  pending:  { label: 'Pending',   className: 'bg-amber-950/40 text-amber-300 border-amber-700/40' },
  approved: { label: 'Live',      className: 'bg-green-950/40 text-forest border-green-700/40' },
  rejected: { label: 'Rejected',  className: 'bg-red-950/40 text-red-300 border-red-700/40' },
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
