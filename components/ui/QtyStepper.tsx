'use client'

import { useState } from 'react'
import { MinusIcon, PlusIcon } from '@/components/icons'

// The one quantity control — product page and cart. The two it replaces were
// 28–32px rounded pills, and the cart's "−" at 1 removed the line: a slip of
// the thumb deleted the item. Here "−" stops at `min` (disabled); removal is
// its own labelled control on the row, never a side effect of counting down.
//
// 44px cells inside a 2px `border-prose` box (black on the page, white in a
// zone — the outline-button pair). `onChange` may return a promise (the cart
// writes to the server): the cells disable while it's in flight, and a
// rejection surfaces as a danger line under the control instead of vanishing.

interface QtyStepperProps {
  value: number
  onChange: (next: number) => void | Promise<void>
  min?: number
  max?: number
  /** What's being counted, for the button labels: "Decrease quantity of Dad Hat". */
  itemLabel?: string
  disabled?: boolean
  className?: string
}

const CELL =
  'inline-flex items-center justify-center w-11 h-11 text-prose transition-colors ' +
  'hover:bg-surface-hover disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:bg-surface-hover'

export function QtyStepper({ value, onChange, min = 1, max = 99, itemLabel, disabled = false, className = '' }: QtyStepperProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const of = itemLabel ? ` of ${itemLabel}` : ''

  async function step(next: number) {
    if (next < min || next > max) return
    setError(null)
    const result = onChange(next)
    if (!(result instanceof Promise)) return
    setBusy(true)
    try {
      await result
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't update the quantity. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const off = disabled || busy
  return (
    <div className={className}>
      <div className="inline-flex items-stretch border-2 border-prose rounded-md overflow-hidden" aria-busy={busy || undefined}>
        <button type="button" onClick={() => step(value - 1)} disabled={off || value <= min} aria-label={`Decrease quantity${of}`} className={CELL}>
          <MinusIcon className="w-4 h-4" strokeWidth={2.5} />
        </button>
        <output aria-live="polite" aria-label={`Quantity${of}`} className="inline-flex items-center justify-center min-w-11 px-1 font-display font-extrabold text-sm text-prose tabular-nums">
          {value}
        </output>
        <button type="button" onClick={() => step(value + 1)} disabled={off || value >= max} aria-label={`Increase quantity${of}`} className={CELL}>
          <PlusIcon className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
      {error && <p role="alert" className="mt-1.5 text-sm font-medium text-danger-ink">{error}</p>}
    </div>
  )
}
