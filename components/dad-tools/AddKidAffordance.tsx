'use client'

import { useState } from 'react'
import KidProfileForm from './KidProfileForm'

interface Props {
  ctaLabel?: string
  variant?: 'inline' | 'empty'
}

export default function AddKidAffordance({
  ctaLabel = 'Add a kid',
  variant = 'inline',
}: Props) {
  const [adding, setAdding] = useState(false)

  if (adding) {
    return (
      <div className="bg-surface border border-faint rounded-2xl p-4 sm:p-5">
        <KidProfileForm
          mode="add"
          onSuccess={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </div>
    )
  }

  if (variant === 'empty') {
    return (
      <div className="bg-surface border border-faint rounded-2xl p-6 text-center space-y-3">
        <p className="text-sm text-prose-faint">
          No kids yet. Add one to start tracking weekends and moments.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {ctaLabel}
          </button>
          <span className="text-xs text-prose-faint">or</span>
          <a
            href="/tools/weekends-until"
            className="text-sm text-accent hover:underline font-medium"
          >
            Try Weekends Until →
          </a>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="w-full sm:w-auto px-4 py-2.5 bg-surface border border-faint border-dashed hover:border-accent hover:bg-accent/5 rounded-xl text-sm text-prose-faint hover:text-prose transition-colors"
    >
      + {ctaLabel}
    </button>
  )
}
