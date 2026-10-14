'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMoment, type KidMoment } from '@/lib/dad-tools/moment-actions'
import { LABELS } from '@/lib/labels'
import { useConfirm } from '@/components/ui/useConfirm'
import { buttonVariants } from '@/components/ui/Button'

interface Props {
  moments: KidMoment[]
}

export default function MomentsFeed({ moments }: Props) {
  if (moments.length === 0) {
    return (
      <p className="text-sm text-prose-faint italic">
        {LABELS.tools.log.emptyState}
      </p>
    )
  }

  return (
    <ul className="space-y-2.5">
      {moments.map((m) => (
        <MomentItem key={m.id} moment={m} />
      ))}
    </ul>
  )
}

function MomentItem({ moment }: { moment: KidMoment }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { confirm: ask, dialog } = useConfirm()

  async function handleDelete() {
    const ok = await ask({
      title: 'Remove this moment?',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await deleteMoment(moment.id)
      if (result.ok) router.refresh()
    })
  }

  const date = moment.occurred_on ?? moment.created_at.slice(0, 10)
  const formatted = formatMomentDate(date)

  return (
    <li className="relative bg-surface-sunken border border-soft rounded-xl px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-prose-faint mb-1">{formatted}</p>
          <p className="text-sm text-prose whitespace-pre-wrap break-words">{moment.response}</p>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className={buttonVariants({ variant: 'ghost', size: 'md', className: 'shrink-0 -my-1 -mr-1' })}
          aria-label="Remove moment"
        >
          {pending ? '…' : 'Remove'}
        </button>
      </div>
      {dialog}
    </li>
  )
}

function formatMomentDate(yyyyMmDd: string): string {
  // Parses as local date to avoid TZ shift.
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  if (!y || !m || !d) return yyyyMmDd
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
