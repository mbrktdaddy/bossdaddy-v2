'use client'

// Shared number input for the calculators (Dad Math + the money tools).
//
// type="text" + inputMode controls the keypad without inheriting
// <input type="number"> footguns — type=number can refuse to overwrite the
// user's typed string when React re-renders with a parsed value, leaving
// leading zeros stuck in the field.
//
// The field owns a DRAFT string and only hands the parent a number. Without
// the draft, typing "6." parsed to 6, re-rendered as "6", and the dot was
// gone — a decimal APR like 6.9% couldn't be typed at all. The draft is
// re-synced (during render, not in an effect) whenever the parent's value
// changes to something the draft doesn't already say — e.g. a kid switch or
// a handoff prefill.
//
// Thousands separators are display-only and arrive on BLUR ("35,000"): while
// the field has focus the raw draft shows, so the caret never jumps mid-type
// and nothing but digits ever reaches `parse`. The look is `fieldClass` (the
// P5 recipe: 16px on a phone, 44px tall) with the label recipe <Field> uses.

import { useId, useState } from 'react'
import { fieldClass } from '@/components/ui/Field'

function parse(s: string): number {
  if (s === '' || s === '.') return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function group(s: string): string {
  const [int, frac] = s.split('.')
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac === undefined ? g : `${g}.${frac}`
}

// Hide 0 behind the placeholder so the field reads as empty waiting for input.
function show(n: number): string {
  return !Number.isFinite(n) || n === 0 ? '' : String(n)
}

export default function NumberField({
  label, help, prefix, suffix, value, placeholder, decimal, onChange,
}: {
  label:        string
  help?:        string
  prefix?:      string
  suffix?:      string
  value:        number
  placeholder?: string
  decimal?:     boolean
  onChange:     (n: number) => void
}) {
  const [draft, setDraft] = useState(show(value))
  const [synced, setSynced] = useState(value)
  const [focused, setFocused] = useState(false)
  const id = useId()
  const helpId = help ? `${id}-help` : undefined
  if (value !== synced) {
    setSynced(value)
    if (parse(draft) !== value) setDraft(show(value))
  }

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    let s = e.target.value.replace(decimal ? /[^\d.]/g : /\D/g, '')
    if (decimal) {
      const dot = s.indexOf('.')
      if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
    }
    const n = parse(s)
    setDraft(s)
    setSynced(n)
    onChange(n)
  }

  return (
    <div>
      <label htmlFor={id} className="block mb-1.5 text-sm font-semibold text-prose">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-prose-faint text-base sm:text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode={decimal ? 'decimal' : 'numeric'}
          value={focused ? draft : group(draft)}
          placeholder={placeholder}
          onChange={handle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-describedby={helpId}
          className={fieldClass({ className: `${prefix ? 'pl-8' : ''} ${suffix ? 'pr-12' : ''}`.trim() })}
          autoComplete="off"
        />
        {suffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-prose-faint text-base sm:text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {help && <p id={helpId} className="text-xs text-prose-muted mt-1.5 leading-snug">{help}</p>}
    </div>
  )
}
