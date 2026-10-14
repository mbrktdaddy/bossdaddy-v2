'use client'

import { useRef } from 'react'
import { PILL_BASE, PILL_ACTIVE, PILL_INACTIVE } from './PillFilterStrip'

// Two-or-three-way exclusive choice (Car/Personal, Snowball/Avalanche, a kid
// picker, units). A radiogroup drawn as the square chip: the selected option
// is the inverted stamp. Arrow keys move the selection (the ARIA radio-group
// pattern) and only the checked option is in the tab order. Moved here from
// the calculators so the kid/unit pickers stop hand-rolling it;
// `CalculatorParts` re-exports it so the six tools didn't churn.

export function Segmented<T extends string>({
  value, options, onChange, label, className = '',
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  /** Accessible name for the group ("Loan type"). */
  label: string
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = Math.max(0, options.findIndex((o) => o.value === value))

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown'
    const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp'
    if (!fwd && !back) return
    e.preventDefault()
    const next = (i + (fwd ? 1 : -1) + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => { refs.current[i] = el }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={i === current ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKeyDown(e, i)}
          className={`${PILL_BASE} ${o.value === value ? PILL_ACTIVE : PILL_INACTIVE}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
