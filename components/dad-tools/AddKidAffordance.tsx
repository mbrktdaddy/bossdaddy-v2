'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LABELS } from '@/lib/labels'
import KidProfileForm from './KidProfileForm'
import { buttonVariants } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface Props {
  ctaLabel?: string
  variant?: 'inline' | 'empty'
  isAuthenticated?: boolean
}

export default function AddKidAffordance({
  ctaLabel = LABELS.tools.kids.addCta,
  variant = 'inline',
  isAuthenticated = false,
}: Props) {
  const [adding, setAdding] = useState(false)

  if (adding) {
    return (
      <Card tone="chrome" className="p-4 sm:p-5">
        <KidProfileForm
          mode="add"
          isAuthenticated={isAuthenticated}
          onSuccess={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </Card>
    )
  }

  if (variant === 'empty') {
    return (
      <Card tone="chrome" className="p-6 text-center space-y-3">
        <p className="text-sm text-prose-faint">
          {LABELS.tools.kids.empty}
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={buttonVariants()}
          >
            {ctaLabel}
          </button>
          <span className="text-xs text-prose-faint">or</span>
          <Link
            href="/tools/weekends-until"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Try {LABELS.tools.weekendsUntil.short}
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-surface border-2 border-dashed border-strong hover:border-prose rounded-xl text-sm font-semibold text-prose-muted hover:text-prose transition-colors"
    >
      + {ctaLabel}
    </button>
  )
}
