'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Field, fieldClass } from '@/components/ui/Field'
import { Modal, CloseButton } from '@/components/ui/Modal'
import { buttonVariants } from '@/components/ui/Button'
import { splitFacts } from '@/lib/content/pipeline/facts'

// The long-form notes field both wizards share (a guide's context, a review's
// testing notes). It is the grounding contract's input, so it has to be
// comfortable to write and re-read at 6,000 characters on a phone:
//   • grows with the text up to ~60% of the viewport, then scrolls inside
//     itself (`field-sizing: content`; a scrollHeight fallback for browsers
//     without it) — no drag handle, which a phone doesn't have anyway
//   • "Expand" opens the same text full-height in the Modal for a long session
//   • the count line shows how many fact lines the outline will get — the
//     outline can place roughly 40–60, so the author sees when they're over

const MAX_FACTS_HINT = 60

const GROW = 'min-h-[9rem] max-h-[60dvh] overflow-y-auto resize-none [field-sizing:content]'

interface Props {
  label: React.ReactNode
  value: string
  onChange: (v: string) => void
  maxLength?: number
  placeholder?: string
  /** One line under the field, before the count. */
  hint?: React.ReactNode
  className?: string
}

export function NotesField({ label, value, onChange, maxLength = 6000, placeholder, hint, className = '' }: Props) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()
  const facts = splitFacts(value).length

  // Fallback auto-grow for browsers without `field-sizing` (Safari, Firefox).
  useEffect(() => {
    const el = ref.current
    if (!el || (typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content'))) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  const count = (
    <span className="tabular-nums">
      {value.length.toLocaleString()}/{maxLength.toLocaleString()}
      {' · '}
      <span className={facts > MAX_FACTS_HINT ? 'text-danger-ink font-medium' : undefined}>
        {facts} {facts === 1 ? 'fact' : 'facts'}
      </span>
      {facts > MAX_FACTS_HINT ? ' — more than an outline can place; trim or merge lines' : ''}
    </span>
  )

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-3 mb-1.5">
        <span className="text-sm font-semibold text-prose">{label}</span>
        <button type="button" onClick={() => setExpanded(true)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Expand
        </button>
      </div>
      <Field
        as="textarea"
        ref={ref}
        label={label}
        hideLabel
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        controlClassName={GROW}
        hint={<>{hint}{hint ? ' ' : null}{count}</>}
      />

      {expanded && (
        <Modal onClose={() => setExpanded(false)} labelledBy={titleId} size="lg" closeOnBackdrop={false} className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 id={titleId} className="font-black uppercase tracking-tight text-base">{label}</h2>
            <CloseButton onClick={() => setExpanded(false)} label="Done" />
          </div>
          <textarea
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={maxLength}
            placeholder={placeholder}
            aria-labelledby={titleId}
            className={fieldClass({ className: 'h-[calc(100dvh-12rem)] resize-none' })}
          />
          <div className="flex items-center justify-between gap-3 mt-3">
            <p className="text-xs text-prose-muted leading-snug">{count}</p>
            <button type="button" onClick={() => setExpanded(false)} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
