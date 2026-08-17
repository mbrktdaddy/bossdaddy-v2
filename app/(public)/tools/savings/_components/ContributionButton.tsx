'use client'

// The action panel on a goal's detail page. Owns the four daily-loop actions:
//
//   1. Yes — log $X      (primary; opens deep-link to payment app)
//   2. Custom amount      (when cadence not set OR user wants to log a non-default amount)
//   3. Skip today         (records a skip; banked days can still cover the cadence)
//   4. Log withdrawal     (real-world emergency; subtracts from total, doesn't break streak)
//
// Phase 2 single-user: keeps it lean. Catch-up backfill is wired in via the
// Custom-amount flow (kind = 'catchup' with a past date).
//
// Deep-link interaction: on the "Yes" tap we kick off the Server Action AND
// navigate the browser to the payment app's deep-link URL in the same gesture.
// The Server Action runs async; the navigation moves the user into their
// PayPal/Venmo/etc. The action log shows the commitment as soon as they come back.

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { LABELS } from '@/lib/labels'
import {
  logContribution,
  logAdjustment,
  skipDay,
  deleteEntry,
} from '@/lib/dad-tools/savings-actions'
import type { SavingsGoal } from '@/lib/dad-tools/savings'
import { fmtUsd, todayYMDLocal } from '@/lib/dad-tools/savings'
import { buildPaymentDeeplink } from '@/lib/dad-tools/savings-deeplinks'

type Drawer = null | 'custom' | 'adjust' | 'skip'

interface Props {
  goal: SavingsGoal
  // Effective destination override — when the goal is in per_participant
  // mode and the viewer has set their own destination, the page passes
  // these so the Yes button deep-links to the viewer's destination rather
  // than the goal owner's. Null fields fall back to the goal-level values.
  effectiveDestinationType?:   SavingsGoal['destination_type'] | null
  effectiveDestinationUrl?:    string | null
  effectiveDestinationLabel?:  string | null
}

export default function ContributionButton({
  goal,
  effectiveDestinationType,
  effectiveDestinationUrl,
  effectiveDestinationLabel,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Drawer>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  // ID of the just-logged entry — drives the "Undo" link on the toast.
  // Cleared when the toast times out or after a successful undo.
  const [lastEntryId, setLastEntryId] = useState<string | null>(null)
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear any in-flight confirmation timer on unmount so we don't try to
  // setState on an unmounted component.
  useEffect(() => () => {
    if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
  }, [])

  const labels = LABELS.tools.savings.action
  const hasCadence = goal.cadence != null && goal.amount_per_cadence != null
  const defaultAmount = Number(goal.amount_per_cadence) || 0

  // Effective destination — fall back to the goal-level fields when the
  // page didn't pass overrides (single-user goals + shared-mode goals).
  const destType  = effectiveDestinationType  ?? goal.destination_type
  const destUrl   = effectiveDestinationUrl   ?? goal.destination_url
  const destLabel = (effectiveDestinationLabel ?? goal.destination_label)?.trim() || null
  const hasUrl    = !!destUrl

  // Use the user's LOCAL today, not the server's UTC today. Server runs in
  // UTC on Vercel; without this override, late-evening contributions for
  // users west of UTC would be stamped with tomorrow's date.
  const todayYMD = todayYMDLocal()

  // Open the destination on Yes tap. Two paths:
  //   1. Recognized payment-app deep link (paypal.me/venmo/cashapp) — open
  //      in same tab if it's a custom-scheme URL (venmo://...) so the OS
  //      can intercept and launch the app. Same-tab nav is required for
  //      app handoff to work reliably on mobile.
  //   2. Generic https:// URL (Chase, 529 portal, bank login, etc.) — open
  //      in a new tab so the user keeps their place on the goal page when
  //      they come back. The Yes commitment is already logged either way.
  function openDeeplink(amount: number): boolean {
    if (typeof window === 'undefined') return false

    const prefillUrl = buildPaymentDeeplink({
      type: destType,
      handleOrUrl: destUrl,
      amount,
      note: goal.name,
    })

    if (prefillUrl) {
      const isAppScheme = !/^https?:\/\//i.test(prefillUrl)
      if (isAppScheme) {
        window.location.href = prefillUrl
      } else {
        window.open(prefillUrl, '_blank', 'noopener,noreferrer')
      }
      return true
    }

    // Generic URL fallback — anything https:// the user pasted (Chase login,
    // 529 portal, a Pool URL we don't recognize as paypal.me, etc.). Open
    // in a new tab; the user types the amount in the destination app.
    if (destUrl && /^https?:\/\//i.test(destUrl)) {
      window.open(destUrl, '_blank', 'noopener,noreferrer')
      return true
    }

    return false
  }

  function showConfirmation(amount: number, mode: 'opened' | 'manual', entryId: string | null) {
    const target = destLabel ?? 'your destination'
    // 'opened' mode reminds the user about the tab workflow: the original
    // Boss Daddy tab stays open in the background, so once they're done at
    // the destination they switch back instead of expecting to be redirected
    // (banks/payment apps can't redirect back — no return-URL standard).
    const message = mode === 'opened'
      ? `Logged ${fmtUsd(amount)}. ${target} opened in a new tab — switch back here when you're done.`
      : `Logged ${fmtUsd(amount)}. Now move ${fmtUsd(amount)} to ${target}.`
    setConfirmation(message)
    setLastEntryId(entryId)
    if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
    // Slightly longer window so the user has a real chance to tap Undo after
    // bouncing back from the destination app/tab.
    confirmationTimer.current = setTimeout(() => {
      setConfirmation(null)
      setLastEntryId(null)
      confirmationTimer.current = null
    }, 8000)
  }

  function doUndo() {
    if (!lastEntryId) return
    const idToDelete = lastEntryId
    // Clear UI optimistically — the toast disappears immediately so the user
    // gets feedback that the undo registered.
    setConfirmation(null)
    setLastEntryId(null)
    if (confirmationTimer.current) {
      clearTimeout(confirmationTimer.current)
      confirmationTimer.current = null
    }
    setError(null)
    startTransition(async () => {
      const result = await deleteEntry({ id: idToDelete })
      if (!result.ok) {
        setError(`Couldn't undo: ${result.error}`)
        return
      }
      router.refresh()
    })
  }

  function doLog(amount: number, kind: 'contribution' | 'catchup', date?: string, note?: string) {
    setError(null)
    startTransition(async () => {
      const result = await logContribution({
        goalId: goal.id,
        amount,
        contributedOn: date ?? todayYMD,
        kind,
        note: note ?? null,
      })
      if (!result.ok) { setError(result.error); return }
      // Deep-link is best-effort. For primary (real-time) contributions on a
      // goal with a destination URL, navigate the user into their payment app
      // (or open their bank/portal in a new tab). Catch-up entries are
      // backfills — they don't auto-link (you already moved the money).
      // The confirmation toast reports whichever mode actually happened.
      const opened = kind === 'contribution' && hasUrl ? openDeeplink(amount) : false
      showConfirmation(amount, opened ? 'opened' : 'manual', result.data?.entry.id ?? null)
      setOpen(null)
      router.refresh()
    })
  }

  function doSkip() {
    setError(null)
    startTransition(async () => {
      const result = await skipDay({ goalId: goal.id, dayKey: todayYMD })
      if (!result.ok) { setError(result.error); return }
      // Skip toasts use 'manual' mode (no deep-link concept for skip).
      setConfirmation('Day skipped.')
      setLastEntryId(result.data?.id ?? null)
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
      confirmationTimer.current = setTimeout(() => {
        setConfirmation(null)
        setLastEntryId(null)
        confirmationTimer.current = null
      }, 8000)
      setOpen(null)
      router.refresh()
    })
  }

  function doAdjust(direction: 'credit' | 'debit', amount: number, note?: string) {
    setError(null)
    startTransition(async () => {
      const result = await logAdjustment({
        goalId: goal.id,
        direction,
        amount,
        occurredOn: todayYMD,
        note: note ?? null,
      })
      if (!result.ok) { setError(result.error); return }
      const verb = direction === 'credit' ? 'added' : 'removed'
      setConfirmation(`Adjustment ${verb} ${fmtUsd(amount)}.`)
      setLastEntryId(result.data?.id ?? null)
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
      confirmationTimer.current = setTimeout(() => {
        setConfirmation(null)
        setLastEntryId(null)
        confirmationTimer.current = null
      }, 8000)
      setOpen(null)
      router.refresh()
    })
  }

  return (
    <section className="bg-surface border border-soft rounded-xl p-6 space-y-4">

      {/* Primary CTA — Yes, log the cadence amount */}
      {hasCadence ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => doLog(defaultAmount, 'contribution')}
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-lg px-5 py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {labels.yes} {fmtUsd(defaultAmount)}
          {hasUrl && destLabel && (
            <span className="text-sm font-medium opacity-80">→ {destLabel}</span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen('custom')}
          className="w-full bg-accent hover:bg-accent-hover text-white font-black text-lg px-5 py-4 rounded-xl transition-colors"
        >
          Add a contribution
        </button>
      )}

      {/* Inline confirmation after a successful action. Includes an Undo
          link when we have the entry ID — gives the user 8 seconds to
          back out if they tapped by mistake or couldn't complete the
          transfer at the destination. */}
      {confirmation && (
        <div className="bg-success-bg border border-success-line text-success-ink rounded-lg px-3 py-2 text-sm flex items-center gap-3 flex-wrap">
          <span className="flex-1 min-w-0">{confirmation}</span>
          {lastEntryId && (
            <button
              type="button"
              onClick={doUndo}
              disabled={pending}
              className="text-xs font-semibold underline hover:no-underline disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Secondary actions row */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <ActionPill label={labels.custom} active={open === 'custom'} onClick={() => setOpen(open === 'custom' ? null : 'custom')} />
        {hasCadence && (
          <ActionPill label={labels.skip} active={open === 'skip'}   onClick={() => setOpen(open === 'skip' ? null : 'skip')} />
        )}
        <ActionPill label={labels.adjust} active={open === 'adjust'} onClick={() => setOpen(open === 'adjust' ? null : 'adjust')} />
      </div>

      {/* Inline drawers */}
      {open === 'custom' && <CustomDrawer pending={pending} onSubmit={doLog} defaultAmount={defaultAmount} todayYMD={todayYMD} />}
      {open === 'skip'   && <SkipDrawer   pending={pending} onConfirm={doSkip} />}
      {open === 'adjust' && <AdjustDrawer pending={pending} onSubmit={doAdjust} />}

      {error && (
        <div className="bg-danger-bg border border-danger-line text-danger-ink rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}
    </section>
  )
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function ActionPill({
  label, active, onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  const base = 'px-3 py-2 rounded-lg border font-medium transition-colors'
  const activeClass = 'bg-accent-tint border-accent-border text-prose'
  const idle = 'bg-surface-sunken border-soft hover:border-accent-border/50 text-prose-muted'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${active ? activeClass : idle}`}
    >
      {label}
    </button>
  )
}

function CustomDrawer({
  pending, onSubmit, defaultAmount, todayYMD,
}: {
  pending: boolean
  onSubmit: (amount: number, kind: 'contribution' | 'catchup', date?: string, note?: string) => void
  defaultAmount: number
  todayYMD: string
}) {
  const [amt, setAmt] = useState(defaultAmount > 0 ? String(defaultAmount * 2) : '5')
  const [date, setDate] = useState(todayYMD)
  const [note, setNote] = useState('')
  const isBackdated = date !== todayYMD
  return (
    <div className="bg-surface-sunken border border-soft rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="custom-amt" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-prose-faint">$</span>
            <input
              id="custom-amt"
              type="number"
              inputMode="decimal"
              min="0.25"
              step="0.25"
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              className="w-full pl-7 pr-3 py-2 bg-background border border-soft focus:border-accent rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>
        <div>
          <label htmlFor="custom-date" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">Date</label>
          <input
            id="custom-date"
            type="date"
            value={date}
            max={todayYMD}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-soft focus:border-accent rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </div>
      <input
        type="text"
        placeholder="Optional note"
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full px-3 py-2 bg-background border border-soft focus:border-accent rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const n = Number(amt)
          if (Number.isFinite(n) && n > 0) onSubmit(n, isBackdated ? 'catchup' : 'contribution', date, note || undefined)
        }}
        className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm"
      >
        Log {isBackdated ? 'catch-up' : 'contribution'}
      </button>
    </div>
  )
}

function SkipDrawer({
  pending, onConfirm,
}: {
  pending: boolean
  onConfirm: () => void
}) {
  return (
    <div className="bg-surface-sunken border border-soft rounded-xl p-4 space-y-3">
      <p className="text-sm text-prose-muted">
        Skip today — banked days will cover the gap if you have any. Otherwise the streak resets.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={onConfirm}
        className="w-full bg-surface-raised border border-strong hover:border-accent-border/50 disabled:opacity-50 text-prose font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm"
      >
        Skip today
      </button>
    </div>
  )
}

// Versatile balance adjustment drawer. Two directions; total updates but
// streak is preserved (adjustments live outside the daily ritual). Use this
// for bonuses, gifts, withdrawals, corrections, or syncing to your actual
// account balance.
function AdjustDrawer({
  pending, onSubmit,
}: {
  pending: boolean
  onSubmit: (direction: 'credit' | 'debit', amount: number, note?: string) => void
}) {
  const [direction, setDirection] = useState<'credit' | 'debit'>('debit')
  const [amt, setAmt] = useState('')
  const [note, setNote] = useState('')
  return (
    <div className="bg-surface-sunken border border-soft rounded-xl p-4 space-y-3">
      <p className="text-xs text-prose-muted leading-snug">
        Edit the balance up or down. Use this for bonuses, gifts, withdrawals,
        corrections, or syncing to your actual account. Streak stays intact —
        adjustments live in a separate lane from the daily ritual.
      </p>
      <div>
        <p className="text-xs text-prose-faint uppercase tracking-widest mb-2">Direction</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirection('credit')}
            className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors min-h-[44px] ${
              direction === 'credit'
                ? 'bg-success-bg border-success-line text-success-ink'
                : 'bg-background border-soft hover:border-accent-border/50 text-prose-muted'
            }`}
          >
            + Add to balance
          </button>
          <button
            type="button"
            onClick={() => setDirection('debit')}
            className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors min-h-[44px] ${
              direction === 'debit'
                ? 'bg-danger-bg border-danger-line text-danger-ink'
                : 'bg-background border-soft hover:border-accent-border/50 text-prose-muted'
            }`}
          >
            − Remove from balance
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="adj-amt" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-prose-faint">$</span>
          <input
            id="adj-amt"
            type="number"
            inputMode="decimal"
            min="0.25"
            step="0.25"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            placeholder="100"
            className="w-full pl-7 pr-3 py-2 bg-background border border-soft focus:border-accent rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </div>
      <input
        type="text"
        placeholder={direction === 'credit' ? 'Where did this come from? (optional)' : 'What happened? (optional)'}
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full px-3 py-2 bg-background border border-soft focus:border-accent rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const n = Number(amt)
          if (Number.isFinite(n) && n > 0) onSubmit(direction, n, note || undefined)
        }}
        className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm"
      >
        {direction === 'credit' ? `Add ${amt ? '$' + amt : ''} to balance`.trim() : `Remove ${amt ? '$' + amt : ''} from balance`.trim()}
      </button>
    </div>
  )
}
