'use client'

import { buttonVariants } from '@/components/ui/Button'

export function ExportButton() {
  return (
    <a
      href="/api/admin/export"
      download
      className={buttonVariants({ variant: 'secondary', size: 'sm' })}
      title="Download all content as JSON"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Export backup
    </a>
  )
}
