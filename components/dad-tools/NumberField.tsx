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

import { useState } from 'react'

function parse(s: string): number {
  if (s === '' || s === '.') return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
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
      <label className="block text-xs text-prose-faint uppercase tracking-widest mb-1.5">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-prose-faint text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode={decimal ? 'decimal' : 'numeric'}
          value={draft}
          placeholder={placeholder}
          onChange={handle}
          className={`w-full ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-12' : 'pr-3'} py-2.5 bg-surface-sunken border border-strong focus:border-accent rounded-xl text-prose text-sm placeholder:text-prose-faint focus:outline-none transition-colors`}
          autoComplete="off"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-prose-faint text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {help && <p className="text-xs text-prose-faint mt-1.5">{help}</p>}
    </div>
  )
}
