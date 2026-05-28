'use client'

// Dad Math interactive surface.
//
// Same structural shape as WeekendsTool — kid selector pills (for signed-in
// users with kids), ad-hoc birthdate input as fallback, then a form that
// drives the calc live. Result lives in <Result /> and renders the Boss
// Daddy headline + the supporting numbers + the next-best action.
//
// Inputs are kid-aware when a kid is selected: initial values load from the
// kid's persisted state (migration 077), and switching kids via the pill
// row reloads inputs from the newly-selected kid's state. The Save button
// writes back to that kid's row.

import { useState, useTransition, useMemo } from 'react'
import { LABELS } from '@/lib/labels'
import { type Kid, updateKidMoneyState } from '@/lib/dad-tools/kid-actions'
import {
  runDadMath,
  DEFAULT_TARGET_BY_18,
  DEFAULT_RETURN_RATE,
  DEFAULT_MONTHLY,
  DEFAULT_BALANCE,
} from '@/lib/dad-tools/dad-math'
import Result from './Result'

interface Props {
  isAuthenticated: boolean
  initialKids: Kid[]
  initialKidId?: string
  initialFromUrl?: {
    birthdate?:      string
    name?:           string
    currentBalance?: number
    monthlyContrib?: number
    targetBy18?:     number
    annualReturn?:   number
  }
}

// Pick the starting kid from URL state + saved kids. Same resolver as
// WeekendsTool — keeps the two tools behaving identically for deep links.
function resolveInitialKid(
  kids: Kid[],
  initialKidId: string | undefined,
  urlBirthdate: string | undefined,
): string | null {
  if (initialKidId) {
    const match = kids.find((k) => k.id === initialKidId)
    if (match) return match.id
  }
  if (urlBirthdate) {
    const match = kids.find((k) => k.birthdate === urlBirthdate)
    if (match) return match.id
  }
  return kids[0]?.id ?? null
}

export default function DadMathTool({ isAuthenticated, initialKids, initialKidId, initialFromUrl }: Props) {
  // Ad-hoc only when the URL has a birthdate AND it doesn't match a saved
  // kid AND no kid id was passed — that's the "shared from someone else"
  // case where the link's birthdate is the source of truth.
  const hydrateAdhoc =
    !!initialFromUrl?.birthdate &&
    !initialKidId &&
    !initialKids.some((k) => k.birthdate === initialFromUrl?.birthdate)

  const initialSelectedKidId =
    hydrateAdhoc ? null : resolveInitialKid(initialKids, initialKidId, initialFromUrl?.birthdate)
  const initialKid = initialSelectedKidId
    ? initialKids.find((k) => k.id === initialSelectedKidId) ?? null
    : null

  const [selectedKidId, setSelectedKidId] = useState<string | null>(initialSelectedKidId)
  const [adhocBirthdate, setAdhocBirthdate] = useState(initialFromUrl?.birthdate ?? '')

  // Initial input state: URL value > selected kid's saved state > defaults.
  // URL state wins on first load so shared "what-if" links override. After
  // mount, switching kids via the pill row reloads inputs from the new kid
  // (handled in selectKid below).
  const [currentBalance, setCurrentBalance] = useState<number>(
    initialFromUrl?.currentBalance ?? initialKid?.money_balance ?? DEFAULT_BALANCE,
  )
  const [monthlyContrib, setMonthlyContrib] = useState<number>(
    initialFromUrl?.monthlyContrib ?? initialKid?.money_monthly ?? DEFAULT_MONTHLY,
  )
  const [targetBy18, setTargetBy18] = useState<number>(
    initialFromUrl?.targetBy18 ?? initialKid?.money_target ?? DEFAULT_TARGET_BY_18,
  )
  const [annualReturn, setAnnualReturn] = useState<number>(
    initialFromUrl?.annualReturn ?? initialKid?.money_return_rate ?? DEFAULT_RETURN_RATE,
  )

  const [saving, startSaving] = useTransition()
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [saveError, setSaveError]       = useState<string | null>(null)

  const selectedKid = initialKids.find((k) => k.id === selectedKidId) ?? null

  // Switch the selected kid AND reload the inputs from that kid's saved
  // state. Keeping these mutations together in an event handler avoids
  // useEffect/setState-in-effect (project lint forbids it).
  function selectKid(kidId: string | null) {
    setSelectedKidId(kidId)
    setSavedMessage(null)
    setSaveError(null)
    if (kidId) {
      const k = initialKids.find((x) => x.id === kidId)
      if (k) {
        setCurrentBalance(k.money_balance)
        setMonthlyContrib(k.money_monthly)
        setTargetBy18(k.money_target)
        setAnnualReturn(k.money_return_rate)
      }
    }
  }

  function handleSave() {
    if (!selectedKid) return
    setSavedMessage(null)
    setSaveError(null)
    startSaving(async () => {
      const r = await updateKidMoneyState({
        id:         selectedKid.id,
        balance:    currentBalance,
        monthly:    monthlyContrib,
        target:     targetBy18,
        returnRate: annualReturn,
      })
      if (r.ok) {
        setSavedMessage(`Saved for ${selectedKid.name?.trim() || 'kid'}.`)
      } else {
        setSaveError(r.error)
      }
    })
  }
  const birthdate   = selectedKid?.birthdate ?? adhocBirthdate
  const name        = selectedKid?.name ?? (initialFromUrl?.name?.trim() || null)
  const hasInput    = birthdate.length === 10

  const result = useMemo(() => {
    if (!hasInput) return null
    return runDadMath({
      birthdate,
      currentBalance,
      monthlyContrib,
      targetBy18,
      annualReturn,
    })
    // Depend on the SOURCE state vars (selectedKidId + adhocBirthdate)
    // rather than the derived `birthdate`/`hasInput` — the React Compiler
    // can prove those are stable, but it can't prove a const derived inside
    // the render body won't be mutated. eslint-disable: the listed deps are
    // a strict superset of what runDadMath reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKidId, adhocBirthdate, currentBalance, monthlyContrib, targetBy18, annualReturn])

  const today = new Date().toISOString().slice(0, 10)
  const showAdhoc = !isAuthenticated || selectedKidId === null || initialKids.length === 0
  const isTryAnotherDateMode = isAuthenticated && initialKids.length > 0 && selectedKidId === null

  return (
    <div className="space-y-7">

      {/* Kid selector — same pattern as WeekendsTool */}
      {isAuthenticated && initialKids.length > 0 && (
        <section className="flex items-center gap-2 flex-wrap">
          {initialKids.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => selectKid(k.id)}
              className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedKidId === k.id
                  ? 'bg-accent text-white'
                  : 'bg-surface border border-faint text-prose-faint hover:text-prose'
              }`}
            >
              {k.name?.trim() || 'Kid'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => selectKid(null)}
            className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedKidId === null
                ? 'bg-accent text-white'
                : 'bg-surface border border-faint text-prose-faint hover:text-prose'
            }`}
          >
            Try another date
          </button>
        </section>
      )}

      {/* Ad-hoc birthdate input */}
      {showAdhoc && (
        <section className="grid grid-cols-1 gap-3">
          {!isTryAnotherDateMode && (
            <p className="text-xs text-prose-faint">
              No account needed. Plug in a birthdate to see the math.
            </p>
          )}
          <div>
            <label className="block text-xs text-prose-faint uppercase tracking-widest mb-1.5">
              Birthdate
            </label>
            <input
              type="date"
              value={adhocBirthdate}
              max={today}
              onChange={(e) => setAdhocBirthdate(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-sunken border border-strong focus:border-accent rounded-xl text-prose text-sm focus:outline-none transition-colors"
            />
          </div>
        </section>
      )}

      {/* Inputs — only render once we have a birthdate, so the form doesn't
          look stranded above empty space. */}
      {hasInput && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField
            label={LABELS.tools.dadMath.form.balance}
            help={LABELS.tools.dadMath.form.balanceHelp}
            prefix="$"
            value={currentBalance}
            placeholder="0"
            onChange={setCurrentBalance}
          />
          <NumberField
            label={LABELS.tools.dadMath.form.monthly}
            help={LABELS.tools.dadMath.form.monthlyHelp}
            prefix="$"
            suffix="/mo"
            value={monthlyContrib}
            placeholder="0"
            onChange={setMonthlyContrib}
          />
          <NumberField
            label={LABELS.tools.dadMath.form.target}
            help={LABELS.tools.dadMath.form.targetHelp}
            prefix="$"
            value={targetBy18}
            placeholder="94000"
            onChange={setTargetBy18}
          />
          <NumberField
            label={LABELS.tools.dadMath.form.returnRate}
            help={LABELS.tools.dadMath.form.returnRateHelp}
            suffix="%"
            value={Math.round(annualReturn * 1000) / 10}
            decimal
            placeholder="6"
            onChange={(pct) => setAnnualReturn(pct / 100)}
          />
        </section>
      )}

      {/* Save for selected kid — only when a real kid is selected (not
          ad-hoc / try-another-date / anonymous). */}
      {hasInput && selectedKid && (
        <section className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : `Save for ${selectedKid.name?.trim() || 'kid'}`}
          </button>
          {savedMessage && (
            <p className="text-sm text-accent font-semibold">{savedMessage}</p>
          )}
          {saveError && (
            <p className="text-sm text-red-700">{saveError}</p>
          )}
        </section>
      )}

      {/* Result */}
      {result && hasInput && (
        <Result
          result={result}
          name={name}
          targetBy18={targetBy18}
        />
      )}

    </div>
  )
}

// Small composed input. type="text" + inputMode controls the keypad without
// inheriting <input type="number"> footguns — type=number can refuse to
// overwrite the user's typed string when React re-renders with a parsed
// value, leaving leading zeros stuck in the field. Owning the displayed
// string here is the robust fix.
function NumberField({
  label, help, prefix, suffix, value, placeholder, decimal, onChange,
}: {
  label:        string
  help:         string
  prefix?:      string
  suffix?:      string
  value:        number
  placeholder?: string
  decimal?:     boolean
  onChange:     (n: number) => void
}) {
  // Strip everything outside the allowed character set, parse, hand the
  // number back to the parent. Empty string → 0. Stray dots in integer
  // mode → stripped.
  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const allowed = decimal ? /[^\d.]/g : /\D/g
    const stripped = e.target.value.replace(allowed, '')
    if (stripped === '' || stripped === '.') {
      onChange(0)
      return
    }
    const n = Number(stripped)
    onChange(Number.isFinite(n) ? n : 0)
  }

  // Display the canonical form of the value. Hide 0 behind the placeholder
  // so the field reads as empty waiting for input, instead of a literal "0"
  // the user has to delete before typing their number.
  const display = !Number.isFinite(value) || value === 0 ? '' : String(value)

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
          value={display}
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
      <p className="text-xs text-prose-faint mt-1.5">{help}</p>
    </div>
  )
}
