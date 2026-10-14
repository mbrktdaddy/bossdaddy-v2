'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Modal } from './Modal'
import { buttonVariants } from './Button'
import { Field } from './Field'

// The one two-step for irreversible actions. Native confirm()/prompt() were in
// nine places: an unstyled OS box that Chrome for Android renders as a grey
// sheet with "OK", that some PWAs suppress outright (returning false — the
// delete silently never happens), and that blocks the main thread.
//
//   const { confirm, prompt, dialog } = useConfirm()
//   if (!(await confirm({ title: 'Delete this goal?', danger: true, confirmLabel: 'Delete' }))) return
//   const name = await prompt({ title: 'Rename', label: 'Name', defaultValue: goal.name })
//   …
//   return <>{…}{dialog}</>
//
// A hook that returns its own element, not a provider: no root wiring, and the
// dialog unmounts with the component that asked. Unmounting mid-question
// resolves it as "cancel" so no await hangs forever.
//
// Focus lands on Cancel for `confirm` (the dialog's first control) — Enter on
// a destructive prompt should be the safe answer. `prompt` focuses its field.

interface ConfirmOptions {
  title: string
  body?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Irreversible (delete, leave, cancel an order): the confirm button takes the danger recipe. */
  danger?: boolean
}

interface PromptOptions extends ConfirmOptions {
  label: string
  defaultValue?: string
  placeholder?: string
  /** Disable the confirm button while the field is blank (default true). */
  required?: boolean
  maxLength?: number
}

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (value: string | null) => void }

function cancelValue(p: Pending) {
  if (p.kind === 'confirm') p.resolve(false)
  else p.resolve(null)
}

export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null)
  const [value, setValue] = useState('')
  const pendingRef = useRef<Pending | null>(null)
  const titleId = useId()

  const open = useCallback((next: Pending) => {
    // A second ask while one is open answers the first with "cancel".
    if (pendingRef.current) cancelValue(pendingRef.current)
    pendingRef.current = next
    setPending(next)
  }, [])

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => open({ kind: 'confirm', opts, resolve })),
    [open],
  )

  const prompt = useCallback(
    (opts: PromptOptions) => new Promise<string | null>((resolve) => {
      setValue(opts.defaultValue ?? '')
      open({ kind: 'prompt', opts, resolve })
    }),
    [open],
  )

  useEffect(() => () => { if (pendingRef.current) cancelValue(pendingRef.current) }, [])

  const settle = useCallback((answer: 'ok' | 'cancel', text?: string) => {
    const p = pendingRef.current
    if (!p) return
    pendingRef.current = null
    setPending(null)
    if (answer === 'cancel') cancelValue(p)
    else if (p.kind === 'confirm') p.resolve(true)
    else p.resolve(text ?? '')
  }, [])

  let dialog: React.ReactNode = null
  if (pending) {
    const { title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = pending.opts
    const isPrompt = pending.kind === 'prompt'
    const blocked = isPrompt && (pending.opts.required ?? true) && value.trim() === ''
    dialog = (
      <Modal onClose={() => settle('cancel')} labelledBy={titleId} size="sm" className="p-6">
        <form
          onSubmit={(e) => { e.preventDefault(); if (!blocked) settle('ok', value.trim()) }}
          className="space-y-5"
        >
          <div>
            <h2 id={titleId} className="font-display font-black uppercase text-lg leading-tight text-prose">{title}</h2>
            {body && <div className="mt-2 text-sm text-prose-muted leading-relaxed">{body}</div>}
          </div>
          {isPrompt && (
            <Field
              label={pending.opts.label}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={pending.opts.placeholder}
              maxLength={pending.opts.maxLength}
              autoFocus
            />
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => settle('cancel')} className={buttonVariants({ variant: 'outline' })}>
              {cancelLabel}
            </button>
            <button type="submit" disabled={blocked} className={buttonVariants({ variant: danger ? 'danger' : 'primary' })}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </Modal>
    )
  }

  return { confirm, prompt, dialog }
}
