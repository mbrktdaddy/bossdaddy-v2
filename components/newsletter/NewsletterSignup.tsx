'use client'

import { useActionState, useId } from 'react'
import { subscribeFromForm, type NewsletterFormState } from '@/app/actions/newsletter'
import { buttonVariants } from '@/components/ui/Button'
import { fieldClass } from '@/components/ui/Field'
import { LabelBlock } from '@/components/ui/LabelBlock'
import { CheckCircleIcon } from '@/components/icons'
import { LABELS } from '@/lib/labels'
import { BRAND } from '@/lib/brand'
import { CAPTURE_CARD } from './styles'

// The one email signup (continuity plan P11). Three shells, one form:
//   block  — the homepage's orange band: the page's one orange block, so
//            chrome-black ink and the `onBlock` field + button (brand-guide §2)
//   card   — the 2px chrome capture card (end of a review/guide, About, gifts)
//   inline — just the form, for a slot that already has its own heading
// and two promises:
//   digest — the weekly email (tags `newsletter`)
//   notify — "tell me when <topic> is live" (tags `notify:<topic>`, never the
//            digest — lib/newsletter/subscribe.ts has the why)
//
// The form is a server action via useActionState, so it works before hydration
// and with JS off, and the answer lands IN the block (B1: the old form POSTed,
// redirected to `/?newsletter=…`, and nothing read the param).
//
// SAME HEIGHT IN EVERY STATE. The form and the confirmation share one grid
// cell — the form goes `invisible` + `inert` rather than unmounting — so the
// cell is always as tall as the taller of the two, and the error line below is
// always mounted with a reserved line. Nothing under the signup moves when you
// submit, on any width.

type Variant = 'block' | 'card' | 'inline'

interface NewsletterSignupProps {
  variant?: Variant
  intent?: 'digest' | 'notify'
  /** notify only — `gift:fathers-day`. Lowercase, [a-z0-9:_-]. */
  topic?: string
  /** Extra digest tags (`review_alerts`). Ignored for notify. */
  interests?: string[]
  eyebrow?: string
  heading?: string
  headingAs?: 'h2' | 'h3'
  /** The line under the heading. */
  body?: string
  buttonLabel?: string
  successMessage?: string
  /** Anchor target (`newsletter` on the homepage — /gifts links to `/#newsletter`). */
  id?: string
  className?: string
}

const INITIAL: NewsletterFormState = { status: 'idle' }

export function NewsletterSignup({
  variant = 'card', intent = 'digest', topic, interests, eyebrow, heading, headingAs: Heading = 'h2',
  body, buttonLabel, successMessage, id, className = '',
}: NewsletterSignupProps) {
  const [state, formAction, pending] = useActionState(subscribeFromForm, INITIAL)
  const onBlock = variant === 'block'
  const notify = intent === 'notify'
  const L = LABELS.newsletter

  const form = (
    <SignupForm
      state={state}
      action={formAction}
      pending={pending}
      onBlock={onBlock}
      intent={intent}
      topic={topic}
      interests={notify ? undefined : interests}
      buttonLabel={buttonLabel ?? (onBlock ? BRAND.actionLine : notify ? L.notify : L.join)}
      successMessage={state.status === 'already'
        ? (notify ? L.notifyAlready : L.already)
        : (successMessage ?? (notify ? L.notifySuccess : L.success))}
    />
  )
  const smallPrint = notify ? L.notifySmallPrint : L.unsubscribe

  if (variant === 'inline') return <div id={id} className={`scroll-mt-24 ${className}`}>{form}</div>

  if (onBlock) {
    return (
      <section id={id} className={`bg-accent text-chrome border-b border-soft scroll-mt-24 ${className}`}>
        <div className="max-w-6xl mx-auto px-6 py-11 md:py-16 grid gap-5 lg:grid-cols-2 lg:items-center lg:gap-10">
          <div>
            <p className="font-display font-extrabold text-[11px] uppercase tracking-[0.2em]">{eyebrow ?? L.name}</p>
            <Heading className="font-black uppercase text-[40px] md:text-[56px] leading-[0.95] tracking-[-0.03em] mt-2">
              {heading ?? L.headline}
            </Heading>
            <p className="font-semibold text-[15px] leading-relaxed mt-3 max-w-[46ch]">{body ?? L.pitch}</p>
          </div>
          <div>
            {form}
            <p className="text-[13px] font-semibold">{notify ? smallPrint : L.smallPrint}</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div id={id} className={`${CAPTURE_CARD} text-center scroll-mt-24 ${className}`}>
      {eyebrow && <LabelBlock className="mb-3">{eyebrow}</LabelBlock>}
      <Heading className="text-xl font-black uppercase text-prose mb-2">{heading ?? L.cardHeading}</Heading>
      <p className="text-sm text-prose-muted mb-5 max-w-md mx-auto">{body ?? L.cadence}</p>
      <div className="max-w-md mx-auto text-left">
        {form}
        <p className="text-xs text-prose-faint text-center">{smallPrint}</p>
      </div>
    </div>
  )
}

function SignupForm({
  state, action, pending, onBlock, intent, topic, interests, buttonLabel, successMessage,
}: {
  state: NewsletterFormState
  action: (form: FormData) => void
  pending: boolean
  onBlock: boolean
  intent: 'digest' | 'notify'
  topic?: string
  interests?: string[]
  buttonLabel: string
  successMessage: string
}) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  const done = state.status === 'success' || state.status === 'already'
  const error = state.status === 'error' ? state.message : ''

  return (
    <>
      <div className="grid">
        <form
          action={action}
          inert={done}
          aria-hidden={done || undefined}
          className={`[grid-area:1/1] flex flex-wrap gap-2 ${done ? 'invisible' : ''}`}
        >
          <input type="hidden" name="intent" value={intent} />
          {topic && <input type="hidden" name="topic" value={topic} />}
          {interests && interests.length > 0 && <input type="hidden" name="interests" value={interests.join(',')} />}
          <label htmlFor={inputId} className="sr-only">{LABELS.newsletter.emailLabel}</label>
          <input
            id={inputId}
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder={LABELS.newsletter.placeholder}
            // Refilled on error — React resets the form after an action.
            defaultValue={state.status === 'error' ? state.email : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={fieldClass({ tone: onBlock ? 'onBlock' : 'page', size: onBlock ? 'lg' : 'md', className: 'flex-1 min-w-0 basis-60' })}
          />
          {/* Wraps to its own full-width line on a phone (the field's basis-60
              leaves no room beside it); one row from sm up. */}
          <button
            type="submit"
            disabled={pending}
            className={buttonVariants({
              variant: onBlock ? 'onBlock' : 'primary',
              size: onBlock ? 'lg' : 'md',
              className: 'basis-full sm:basis-auto',
            })}
          >
            {pending ? LABELS.newsletter.submitting : buttonLabel}
          </button>
        </form>
        <p
          role="status"
          className={`[grid-area:1/1] self-center flex items-center gap-2 font-semibold text-base ${onBlock ? 'text-chrome' : 'text-prose'}`}
        >
          {done && (
            <>
              <CheckCircleIcon className={`w-5 h-5 shrink-0 ${onBlock ? '' : 'text-success-ink'}`} strokeWidth={2} />
              {successMessage}
            </>
          )}
        </p>
      </div>
      {/* Always mounted, one line reserved — an error must not push the page down. */}
      <p
        id={errorId}
        role="alert"
        className={`min-h-6 mt-1.5 mb-1 text-sm font-semibold leading-6 ${onBlock ? 'text-chrome' : 'text-danger-ink'}`}
      >
        {error}
      </p>
    </>
  )
}
