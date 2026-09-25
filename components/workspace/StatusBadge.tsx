import { Badge, type BadgeTone } from '@/components/ui/Badge'

const STATUS_CONFIG: Record<string, { label: string; tone: BadgeTone }> = {
  draft:    { label: 'Draft',    tone: 'neutral' },
  pending:  { label: 'Pending',  tone: 'warn' },
  approved: { label: 'Live',     tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

export function StatusBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return <Badge tone={config.tone} size={size}>{config.label}</Badge>
}
