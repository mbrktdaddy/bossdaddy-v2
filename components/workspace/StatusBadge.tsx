const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:    { label: 'Draft',     className: 'bg-gray-800 text-gray-400 border-gray-700' },
  pending:  { label: 'Pending',   className: 'bg-yellow-950/60 text-yellow-400 border-yellow-900/60' },
  approved: { label: 'Live',      className: 'bg-green-950/60 text-green-400 border-green-900/60' },
  rejected: { label: 'Rejected',  className: 'bg-red-950/60 text-red-400 border-red-900/60' },
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
