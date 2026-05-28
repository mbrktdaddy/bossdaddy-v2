'use client'

// Create-or-edit form for a savings goal. Progressive disclosure: the
// "rhythm" toggle reveals cadence + amount; the "target" toggle reveals
// the target inputs; destination type reveals the handle/URL field.
//
// Mirrors the form patterns in /tools/weekends-until — native form,
// useTransition for pending state, inline error display. No react-hook-form.

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { LABELS } from '@/lib/labels'
import type {
  SavingsCadence,
  DestinationType,
  DestinationMode,
} from '@/lib/dad-tools/savings'
import { createGoal, updateGoal } from '@/lib/dad-tools/savings-actions'
import { describeDestination } from '@/lib/dad-tools/savings-deeplinks'
import type { Kid } from '@/lib/dad-tools/kid-actions'
import {
  DESTINATION_CATEGORIES,
  presetsByCategory,
  type DestinationCategory,
  type DestinationPreset,
} from '@/lib/dad-tools/destination-presets'

type RhythmMode = 'regular' | 'freeform'
type TargetMode = 'none' | 'amount' | 'date' | 'both'

export interface GoalFormInitial {
  id?:                  string
  name?:                string
  description?:         string | null
  kid_profile_id?:      string | null
  cadence?:             SavingsCadence | null
  amount_per_cadence?:  number | null
  target_amount?:       number | null
  target_date?:         string | null
  destination_mode?:    DestinationMode
  destination_type?:    DestinationType | null
  destination_url?:     string | null
  destination_label?:   string | null
  reminder_enabled?:    boolean
  reminder_cadence?:    'daily' | 'weekly' | 'monthly' | 'off' | null
  reminder_hour_utc?:   number | null
}

// UTC reminder-hour options. Labels include the corresponding US Eastern
// equivalent so users picking a time can sanity-check it against their day.
// We do NOT do per-user timezones — that's user-profile scope, not goal scope.
const REMINDER_HOUR_OPTIONS: { value: number; label: string }[] = [
  { value: 12, label: '12:00 UTC (7am ET)' },
  { value: 13, label: '13:00 UTC (8am ET)' },
  { value: 14, label: '14:00 UTC (9am ET)' },
  { value: 15, label: '15:00 UTC (10am ET)' },
  { value: 16, label: '16:00 UTC (11am ET)' },
  { value: 17, label: '17:00 UTC (noon ET)' },
  { value: 18, label: '18:00 UTC (1pm ET)' },
  { value: 22, label: '22:00 UTC (5pm ET)' },
  { value: 23, label: '23:00 UTC (6pm ET)' },
  { value: 0,  label: '00:00 UTC (7pm ET)' },
  { value: 1,  label: '01:00 UTC (8pm ET)' },
  { value: 2,  label: '02:00 UTC (9pm ET)' },
]

interface Props {
  mode:        'create' | 'edit'
  initial?:    GoalFormInitial
  kids:        Kid[]
}

function pickRhythmMode(c: SavingsCadence | null | undefined): RhythmMode {
  return c ? 'regular' : 'freeform'
}

function pickTargetMode(amount: unknown, date: unknown): TargetMode {
  const hasAmount = amount != null && amount !== ''
  const hasDate   = date != null && date !== ''
  if (hasAmount && hasDate) return 'both'
  if (hasAmount)            return 'amount'
  if (hasDate)              return 'date'
  return 'none'
}

export default function GoalForm({ mode, initial, kids }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Form state — controlled fields with sensible defaults
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [kidId, setKidId] = useState<string>(initial?.kid_profile_id ?? '')

  const [rhythm, setRhythm] = useState<RhythmMode>(pickRhythmMode(initial?.cadence))
  const [cadence, setCadence] = useState<SavingsCadence>(initial?.cadence ?? 'daily')
  const [amount, setAmount] = useState<string>(
    initial?.amount_per_cadence != null ? String(initial.amount_per_cadence) : '2'
  )

  const [target, setTarget] = useState<TargetMode>(
    pickTargetMode(initial?.target_amount, initial?.target_date)
  )
  const [targetAmount, setTargetAmount] = useState<string>(
    initial?.target_amount != null ? String(initial.target_amount) : ''
  )
  const [targetDate, setTargetDate] = useState<string>(initial?.target_date ?? '')

  const [destUrl, setDestUrl] = useState<string>(initial?.destination_url ?? '')
  const [destLabel, setDestLabel] = useState<string>(initial?.destination_label ?? '')

  // Reminders — default ON for new goals so the daily-loop habit kicks in.
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(initial?.reminder_enabled ?? true)
  const [reminderCadence, setReminderCadence] = useState<'daily' | 'weekly' | 'monthly' | 'off'>(
    (initial?.reminder_cadence ?? (initial?.cadence ?? 'daily')) as 'daily' | 'weekly' | 'monthly' | 'off'
  )
  const [reminderHourUtc, setReminderHourUtc] = useState<number>(
    initial?.reminder_hour_utc ?? 13   // 8am ET default
  )

  // Two-step picker — category, then specific preset. When a preset is picked
  // we auto-fill label + URL; the user can still tweak both fields below.
  // Selection state lives in the form; nothing persisted server-side beyond
  // the resulting label + URL.
  const [pickerCategory, setPickerCategory] = useState<DestinationCategory | null>(null)
  const [pickedPresetId, setPickedPresetId] = useState<string | null>(null)
  const pickedPreset: DestinationPreset | undefined = pickedPresetId
    ? presetsByCategory(pickerCategory ?? 'other').find((p) => p.id === pickedPresetId)
    : undefined

  function applyPreset(preset: DestinationPreset) {
    setPickedPresetId(preset.id)
    setDestLabel(preset.label)
    // Only auto-fill URL when the preset has one AND the user hasn't typed
    // a handle yet (payment-app presets leave URL blank for the user to add
    // their own handle/URL).
    if (preset.url) setDestUrl(preset.url)
    else if (!preset.requiresHandle) setDestUrl('')
  }

  // Live auto-detection: as the user types/pastes a URL, surface what will
  // happen on Yes tap. Works regardless of picker selection — the URL is
  // still the source of truth for what the Yes button does.
  const destBehavior = useMemo(
    () => describeDestination(destUrl.trim() || null),
    [destUrl],
  )

  const suggestKidTie = pickedPreset?.suggestsKidTie && !kidId

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) { setError('Give your goal a name.'); return }

    let parsedCadence: SavingsCadence | null = null
    let parsedAmount: number | null = null
    if (rhythm === 'regular') {
      parsedCadence = cadence
      const n = Number(amount)
      if (!Number.isFinite(n) || n <= 0) {
        setError('Enter a positive amount per ' + cadence + ' contribution.')
        return
      }
      parsedAmount = n
    }

    let parsedTargetAmount: number | null = null
    if (target === 'amount' || target === 'both') {
      const n = Number(targetAmount)
      if (!Number.isFinite(n) || n <= 0) { setError('Enter a target amount.'); return }
      parsedTargetAmount = n
    }

    let parsedTargetDate: string | null = null
    if (target === 'date' || target === 'both') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) { setError('Pick a target date.'); return }
      parsedTargetDate = targetDate
    }

    const payload = {
      name: trimmed,
      description: description.trim() || null,
      kid_profile_id: kidId || null,
      cadence: parsedCadence,
      amount_per_cadence: parsedAmount,
      target_amount: parsedTargetAmount,
      target_date: parsedTargetDate,
      destination_mode: 'per_participant' as DestinationMode,
      // Auto-detect from URL — null when no URL or no known pattern.
      destination_type: destBehavior.type,
      destination_url: destUrl.trim() || null,
      destination_label: destLabel.trim() || null,
      reminder_enabled: reminderEnabled,
      reminder_cadence: reminderEnabled ? reminderCadence : 'off' as const,
      reminder_hour_utc: reminderHourUtc,
    }

    startTransition(async () => {
      const result = mode === 'create'
        ? await createGoal(payload)
        : await updateGoal({ id: initial?.id ?? '', ...payload })
      if (!result.ok) {
        setError(result.error)
        return
      }
      const goalId = mode === 'create'
        ? (result as { data?: { id: string } }).data?.id
        : initial?.id
      if (goalId) {
        router.push(`/tools/savings/${goalId}`)
      } else {
        router.push('/tools/savings')
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">

      {/* ── Name + description + kid ────────────────────────────────────── */}
      <section className="bg-surface border border-soft rounded-xl p-6 space-y-5">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          About this goal
        </p>

        <div>
          <label htmlFor="goal-name" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
            Name
          </label>
          <input
            id="goal-name"
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Camping trip 2026"
            className="w-full px-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        <div>
          <label htmlFor="goal-desc" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
            What this is for <span className="text-prose-faint normal-case">(optional)</span>
          </label>
          <textarea
            id="goal-desc"
            rows={2}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Saving up so the kids and I can do Yellowstone next summer."
            className="w-full px-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        {kids.length > 0 && (
          <div>
            <label htmlFor="goal-kid" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
              Tie to a kid <span className="text-prose-faint normal-case">(optional)</span>
            </label>
            <select
              id="goal-kid"
              value={kidId}
              onChange={(e) => setKidId(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="">No kid tag</option>
              {kids.map((k) => (
                <option key={k.id} value={k.id}>{k.name ?? 'Unnamed kid'}</option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* ── Rhythm ──────────────────────────────────────────────────────── */}
      <section className="bg-surface border border-soft rounded-xl p-6 space-y-5">
        <div>
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">
            Rhythm
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: 'regular',  label: 'Regular amount',  body: 'Set a daily, weekly, or monthly target.' },
              { v: 'freeform', label: 'Add whenever',     body: 'Drop in money on your own schedule.' },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setRhythm(opt.v as RhythmMode)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  rhythm === opt.v
                    ? 'bg-accent-tint border-accent-border text-prose'
                    : 'bg-surface-sunken border-soft hover:border-accent-border/50 text-prose-muted'
                }`}
              >
                <p className="text-sm font-semibold">{opt.label}</p>
                <p className="text-xs text-prose-faint mt-1">{opt.body}</p>
              </button>
            ))}
          </div>
        </div>

        {rhythm === 'regular' && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label htmlFor="goal-cadence" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
                Cadence
              </label>
              <select
                id="goal-cadence"
                value={cadence}
                onChange={(e) => setCadence(e.target.value as SavingsCadence)}
                className="w-full px-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="daily">{LABELS.tools.savings.cadences.daily}</option>
                <option value="weekly">{LABELS.tools.savings.cadences.weekly}</option>
                <option value="monthly">{LABELS.tools.savings.cadences.monthly}</option>
              </select>
            </div>
            <div>
              <label htmlFor="goal-amt" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-prose-faint">$</span>
                <input
                  id="goal-amt"
                  type="number"
                  inputMode="decimal"
                  min="0.25"
                  step="0.25"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Target ──────────────────────────────────────────────────────── */}
      <section className="bg-surface border border-soft rounded-xl p-6 space-y-5">
        <div>
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">
            Target
          </p>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {[
              { v: 'none',   label: 'No target' },
              { v: 'amount', label: 'Amount' },
              { v: 'date',   label: 'Date' },
              { v: 'both',   label: 'Both' },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setTarget(opt.v as TargetMode)}
                className={`px-2 py-3 rounded-lg border transition-colors min-h-[44px] ${
                  target === opt.v
                    ? 'bg-accent-tint border-accent-border text-prose font-semibold'
                    : 'bg-surface-sunken border-soft hover:border-accent-border/50 text-prose-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {(target === 'amount' || target === 'both') && (
          <div>
            <label htmlFor="goal-target-amt" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
              Target amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-prose-faint">$</span>
              <input
                id="goal-target-amt"
                type="number"
                inputMode="decimal"
                min="1"
                step="1"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="500"
                className="w-full pl-7 pr-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
        )}

        {(target === 'date' || target === 'both') && (
          <div>
            <label htmlFor="goal-target-date" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
              Target date
            </label>
            <input
              id="goal-target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        )}
      </section>

      {/* ── Destination ─────────────────────────────────────────────────── */}
      <section className="bg-surface border border-soft rounded-xl p-6 space-y-5">
        <div>
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">
            Where the money goes
          </p>
          <p className="text-xs text-prose-faint">
            Pick a category, then a specific destination. We never move money — when you
            tap Yes, we open the link and you confirm the transfer yourself.
          </p>
        </div>

        {/* Step 1 — category */}
        <div>
          <p className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
            Category
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {DESTINATION_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setPickerCategory(cat.id)
                  setPickedPresetId(null)
                }}
                className={`text-left px-3 py-3 rounded-lg border transition-colors min-h-[44px] ${
                  pickerCategory === cat.id
                    ? 'bg-accent-tint border-accent-border text-prose'
                    : 'bg-surface-sunken border-soft hover:border-accent-border/50 text-prose-muted'
                }`}
              >
                <p className="text-sm font-semibold leading-tight">{cat.label}</p>
                <p className="text-[10px] text-prose-faint mt-0.5 leading-snug">{cat.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2 — preset chips for selected category */}
        {pickerCategory && pickerCategory !== 'other' && (
          <div>
            <p className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
              Pick one
            </p>
            <div className="flex flex-wrap gap-2">
              {presetsByCategory(pickerCategory).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`text-sm px-3 py-2 rounded-lg border transition-colors min-h-[44px] ${
                    pickedPresetId === p.id
                      ? 'bg-accent-tint border-accent-border text-prose font-semibold'
                      : 'bg-surface-sunken border-soft hover:border-accent-border/50 text-prose-muted'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {pickedPreset?.description && (
              <p className="text-xs text-prose-faint mt-2 leading-snug">{pickedPreset.description}</p>
            )}
            {suggestKidTie && (
              <p className="mt-2 text-xs text-info-ink bg-info-bg border border-info-line rounded-lg px-3 py-2 leading-snug">
                This works best when tied to a kid — scroll up and pick one in the &quot;Tie to a kid&quot; field.
              </p>
            )}
          </div>
        )}

        {/* Label + URL — auto-filled from preset, editable */}
        <div>
          <label htmlFor="goal-dest-label" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
            Label
          </label>
          <input
            id="goal-dest-label"
            type="text"
            maxLength={120}
            value={destLabel}
            onChange={(e) => setDestLabel(e.target.value)}
            placeholder="Auto-fills when you pick above — or type your own"
            className="w-full px-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          {pickedPreset && (
            <p className="text-xs text-prose-faint mt-1.5">
              Edit to add specifics — e.g., &quot;Chase Savings (Camping bucket)&quot; or &quot;Indiana 529.&quot;
            </p>
          )}
        </div>

        <div>
          <label htmlFor="goal-dest-url" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
            URL or handle <span className="text-prose-faint normal-case">(optional)</span>
          </label>
          <input
            id="goal-dest-url"
            type="text"
            value={destUrl}
            onChange={(e) => setDestUrl(e.target.value)}
            placeholder={
              pickedPreset?.requiresHandle && pickedPreset.handleHint
                ? pickedPreset.handleHint
                : 'Login URL, payment handle, or leave blank for cash / manual destinations'
            }
            className="w-full px-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <div className={`mt-2 px-3 py-2 rounded-lg border text-xs leading-snug ${
            destBehavior.willPrefill
              ? 'bg-success-bg border-success-line text-success-ink'
              : destBehavior.willOpenUrl
                ? 'bg-info-bg border-info-line text-info-ink'
                : 'bg-surface-sunken border-soft text-prose-muted'
          }`}>
            {destBehavior.message}
          </div>
        </div>
      </section>

      {/* ── Reminders ────────────────────────────────────────────────────── */}
      <section className="bg-surface border border-soft rounded-xl p-6 space-y-5">
        <div>
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">
            Reminders
          </p>
          <p className="text-xs text-prose-faint">
            We&apos;ll email you (and any spouse you invite) at the cadence you pick.
            Times are in UTC — pick whichever lands in your morning.
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={(e) => setReminderEnabled(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          <span className="text-sm text-prose">Send me reminders</span>
        </label>

        {reminderEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="reminder-cadence" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
                Cadence
              </label>
              <select
                id="reminder-cadence"
                value={reminderCadence}
                onChange={(e) => setReminderCadence(e.target.value as 'daily' | 'weekly' | 'monthly' | 'off')}
                className="w-full px-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label htmlFor="reminder-hour" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
                Time
              </label>
              <select
                id="reminder-hour"
                value={reminderHourUtc}
                onChange={(e) => setReminderHourUtc(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                {REMINDER_HOUR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-danger-bg border border-danger-line text-danger-ink rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          {pending
            ? (mode === 'create' ? 'Creating…' : 'Saving…')
            : (mode === 'create' ? LABELS.tools.savings.newCta : 'Save changes')}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-prose-faint hover:text-prose-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
