import { useId } from 'react'

// The one form field. ~30 inputs were on four recipes, every one 14px / 40px:
// iPhone Safari zooms the page on focus below 16px, and 40px is under the tap
// floor. This is 16px on a phone (`text-base sm:text-sm`) and 44px tall.
//
// Mirrors `buttonVariants`: `fieldClass()` is the string — for the odd input
// that can't use the wrapper (a search box in a toolbar, a one-line inline
// form) — and <Field> is the wrapper that wires the label, hint and error to
// the control with `htmlFor` / `aria-describedby` / `aria-invalid` (useId — it
// works in Server Components, so plain no-JS forms can use this too).
//   page    — the white page: 1px strong edge, accent focus
//   onBlock — sitting ON an orange block (newsletter): 2px chrome edge and a
//             chrome focus ring — an accent ring vanishes into the orange
// `className` on fieldClass is for layout (flex-1, max-w-xs), never size/colour.

const BASE =
  'block w-full px-3.5 py-2.5 rounded-md text-base sm:text-sm text-prose ' +
  'placeholder:text-prose-faint bg-surface transition-colors focus:outline-none ' +
  'disabled:opacity-60 disabled:cursor-not-allowed'

const TONE = {
  page:    'border border-strong focus:border-accent focus:ring-1 focus:ring-accent aria-[invalid=true]:border-danger-ink',
  onBlock: 'border-2 border-chrome focus:ring-2 focus:ring-chrome',
} as const

// md matches the md button (44px); lg sits beside an lg button (48px) in a
// one-line form — the newsletter block — so the pair shares one baseline.
const SIZE = { md: 'min-h-[44px]', lg: 'min-h-[48px]' } as const

export type FieldTone = keyof typeof TONE

export function fieldClass({ tone = 'page', size = 'md', className = '' }: { tone?: FieldTone; size?: keyof typeof SIZE; className?: string } = {}) {
  return `${BASE} ${SIZE[size]} ${TONE[tone]}${className ? ` ${className}` : ''}`
}

interface FieldCommon {
  label: React.ReactNode
  /** Visually hide the label (it stays for screen readers) — one-line inline forms only. */
  hideLabel?: boolean
  hint?: React.ReactNode
  /** Shown under the control in the danger ink; also sets aria-invalid. */
  error?: React.ReactNode
  tone?: FieldTone
  /** Wrapper layout (mt-4, sm:col-span-2…). */
  className?: string
  /** Control layout (max-w-xs, font-mono…). */
  controlClassName?: string
  id?: string
}

type InputFieldProps = FieldCommon & { as?: 'input'; ref?: React.Ref<HTMLInputElement> } &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'>
type TextareaFieldProps = FieldCommon & { as: 'textarea'; ref?: React.Ref<HTMLTextAreaElement> } &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'id'>

export function Field(props: InputFieldProps | TextareaFieldProps) {
  const autoId = useId()
  const { as = 'input', label, hideLabel = false, hint, error, tone = 'page', className = '', controlClassName = '', id: idProp, ...rest } = props
  const id = idProp ?? autoId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const a11y = { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined }
  const cls = fieldClass({ tone, className: controlClassName })

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={hideLabel ? 'sr-only' : `block mb-1.5 text-sm font-semibold ${tone === 'onBlock' ? 'text-chrome' : 'text-prose'}`}
      >
        {label}
      </label>
      {/* `as` discriminates the union; destructuring it off loses the narrowing, hence the casts. */}
      {as === 'textarea'
        ? <textarea {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} {...a11y} className={cls} />
        : <input {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} {...a11y} className={cls} />}
      {hint && <p id={hintId} className="mt-1.5 text-xs text-prose-muted leading-snug">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-sm font-medium text-danger-ink leading-snug">{error}</p>}
    </div>
  )
}
