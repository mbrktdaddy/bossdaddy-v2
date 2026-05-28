'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMoment, type KidMoment } from '@/lib/dad-tools/moment-actions'
import { LABELS } from '@/lib/labels'

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
  const [confirming, setConfirming] = useState(false)

  function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    startTransition(async () => {
      const result = await deleteMoment(moment.id)
      if (result.ok) router.refresh()
      setConfirming(false)
    })
  }

  const date = moment.occurred_on ?? moment.created_at.slice(0, 10)
  const formatted = formatMomentDate(date)

  return (
    <li className="group relative bg-surface-sunken border border-faint rounded-xl px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-prose-faint mb-1">{formatted}</p>
          <p className="text-sm text-prose whitespace-pre-wrap break-words">{moment.response}</p>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className={`shrink-0 text-xs px-2 py-1 rounded-md transition-colors ${
            confirming
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'text-prose-faint hover:text-red-700 opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
          aria-label={confirming ? 'Confirm remove' : 'Remove moment'}
        >
          {pending ? '…' : confirming ? 'Confirm' : 'Remove'}
        </button>
      </div>
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
