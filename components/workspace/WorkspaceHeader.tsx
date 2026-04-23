import Link from 'next/link'
import { ReactNode } from 'react'

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
        className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors mb-3"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {backLabel}
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-black leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
    </div>
  )
}
