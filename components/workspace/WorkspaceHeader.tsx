import Link from 'next/link'
import { ReactNode } from 'react'
import { ChevronLeftIcon } from '@/components/icons'

interface Props {
  backHref: string
  backLabel?: string
  title: string
  subtitle?: string
  rightSlot?: ReactNode
}

export function WorkspaceHeader({ backHref, backLabel = 'Back', title, subtitle, rightSlot }: Props) {
  return (
    <div className="mb-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-xs text-prose-faint hover:text-prose transition-colors mb-3"
      >
        <ChevronLeftIcon className="w-3 h-3" strokeWidth={2} />
        {backLabel}
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-black leading-tight line-clamp-2 sm:line-clamp-none">{title}</h1>
          {subtitle && <p className="text-sm text-prose-faint mt-1 line-clamp-1 sm:line-clamp-none">{subtitle}</p>}
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
    </div>
  )
}
