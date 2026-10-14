'use client'

import { useState, useMemo, useEffect } from 'react'
import { Segmented, ResultCard } from '@/components/dad-tools/CalculatorParts'
import { Field } from '@/components/ui/Field'
import { LABELS } from '@/lib/labels'
import { type Kid } from '@/lib/dad-tools/kid-actions'
import { recordWeekendsRun } from '@/lib/dad-tools/moment-actions'
import {
  milestoneDate,
  unitsRemaining,
  isMilestonePassed,
  ageInYears,
  isBrandNew,
  type Milestone,
  type Unit,
} from '@/lib/dad-tools/calc'
import {
  milestoneHeadline,
  milestonePassedHeadline,
  brandNewHeadline,
} from '@/lib/dad-tools/milestone-copy'
import Result from './Result'

const MILESTONES: { id: Milestone; label: string }[] = [
  { id: 'until_18',      label: LABELS.tools.milestones.until_18 },
  { id: 'next_birthday', label: LABELS.tools.milestones.next_birthday },
  { id: 'starts_school', label: LABELS.tools.milestones.starts_school },
  { id: 'gets_license',  label: LABELS.tools.milestones.gets_license },
  { id: 'summer',        label: LABELS.tools.milestones.summer },
  { id: 'custom',        label: LABELS.tools.milestones.custom },
]

const UNITS: { id: Unit; label: string }[] = [
  { id: 'weekends', label: LABELS.tools.units.weekends },
  { id: 'bedtimes', label: LABELS.tools.units.bedtimes },
]

interface Props {
  isAuthenticated: boolean
  initialKids: Kid[]
  initialKidId?: string
  initialFromUrl?: {
    birthdate?: string
    milestone?: Milestone
    unit?: Unit
    name?: string
    customDate?: string
    customLabel?: string
  }
}

// Pick the right starting kid from a URL/kid-list combo. Order of preference:
//   1. Explicit ?kid=<id> that matches a saved kid.
//   2. URL birthdate that exactly matches a saved kid's birthdate (the link
//      came from this user's own kid page, so don't drop them into ad-hoc).
//   3. First saved kid.
//   4. null → triggers ad-hoc input mode.
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

// Segmented values are strings; this stands in for "no saved kid selected".
const ADHOC = '__adhoc__'

export default function WeekendsTool({ isAuthenticated, initialKids, initialKidId, initialFromUrl }: Props) {
  // Resolve the starting kid up front. If the URL carries a birthdate that
  // doesn't match any saved kid (e.g., a shared link from someone else),
  // hydrateAdhoc kicks in below and overrides selection to null.
  const hydrateAdhoc =
    !!initialFromUrl?.birthdate &&
    !initialKidId &&
    !initialKids.some((k) => k.birthdate === initialFromUrl?.birthdate)

  const [selectedKidId, setSelectedKidId] = useState<string | null>(
    hydrateAdhoc ? null : resolveInitialKid(initialKids, initialKidId, initialFromUrl?.birthdate),
  )
  const [adhocBirthdate, setAdhocBirthdate] = useState(initialFromUrl?.birthdate ?? '')
  const [adhocName,      setAdhocName]      = useState(initialFromUrl?.name ?? '')

  const [milestone,      setMilestone]      = useState<Milestone>(initialFromUrl?.milestone ?? 'until_18')
  const [unit,           setUnit]           = useState<Unit>(initialFromUrl?.unit ?? 'weekends')
  const [customDate,     setCustomDate]     = useState(initialFromUrl?.customDate ?? '')
  const [customLabel,    setCustomLabel]    = useState(initialFromUrl?.customLabel ?? '')

  const selectedKid = initialKids.find((k) => k.id === selectedKidId) ?? null
  const birthdate   = selectedKid?.birthdate ?? adhocBirthdate
  const name        = selectedKid?.name ?? (adhocName.trim() || null)
  const hasInput    = birthdate.length === 10

  const result = useMemo(() => {
    if (!hasInput) return null

    const passed = isMilestonePassed(milestone, birthdate, customDate || null)
    // If the kid has already crossed a backward milestone (Until 18, school,
    // license), swap to next_birthday and surface a passed-headline note.
    const effective: Milestone = passed ? 'next_birthday' : milestone

    const target = milestoneDate(effective, birthdate, customDate || null)
    if (!target) return null

    const N = unitsRemaining(unit, target)
    const age = ageInYears(birthdate)
    const brandNew = isBrandNew(birthdate)

    const headline = brandNew && milestone === 'until_18'
      ? brandNewHeadline(name)
      : milestoneHeadline({
          milestone: effective,
          N,
          unit,
          name,
          age,
          customLabel: customLabel || null,
        })

    const passedHeadline = passed
      ? milestonePassedHeadline({ milestone, name })
      : null

    return { N, headline, passedHeadline, milestone: effective }
  }, [hasInput, milestone, unit, birthdate, name, customDate, customLabel])

  // Fire-and-forget intent capture once we have a stable result.
  useEffect(() => {
    if (!hasInput) return
    void recordWeekendsRun({
      kid_profile_id: selectedKid?.id ?? null,
      milestone,
      unit,
      birthdate,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthdate, milestone, unit])

  const today = new Date().toISOString().slice(0, 10)
  const showAdhoc = !isAuthenticated || selectedKidId === null || initialKids.length === 0
  // "Try another date" mode: signed-in user toggled off their saved kid to plug
  // in a hypothetical. The name field is suppressed in this mode — a what-if
  // doesn't need to belong to anyone.
  const isTryAnotherDateMode = isAuthenticated && initialKids.length > 0 && selectedKidId === null

  return (
    <div className="space-y-7">

      {/* Kid selector (logged-in with at least one kid) */}
      {isAuthenticated && initialKids.length > 0 && (
        <Segmented
          label="Whose number"
          value={selectedKidId ?? ADHOC}
          onChange={(v) => setSelectedKidId(v === ADHOC ? null : v)}
          options={[
            ...initialKids.map((k) => ({ value: k.id, label: k.name?.trim() || 'Kid' })),
            { value: ADHOC, label: 'Try another date' },
          ]}
        />
      )}

      {/* Ad-hoc input (anonymous OR logged-in without a kid selected).
          In "Try another date" mode (signed-in with kids, toggled off), the
          name field is suppressed — a hypothetical date doesn't need to
          belong to anyone. */}
      {showAdhoc && (
        <section className={`grid grid-cols-1 ${isTryAnotherDateMode ? '' : 'sm:grid-cols-2'} gap-3`}>
          {!isTryAnotherDateMode && (
            <Field
              label="Kid’s name (optional)"
              type="text"
              value={adhocName}
              maxLength={80}
              onChange={(e) => setAdhocName(e.target.value)}
              placeholder="Mason"
              autoComplete="off"
            />
          )}
          <Field
            label="Birthdate"
            type="date"
            value={adhocBirthdate}
            max={today}
            onChange={(e) => setAdhocBirthdate(e.target.value)}
          />
        </section>
      )}

      {/* Milestone picker */}
      {hasInput && (
        <section className="space-y-4">
          <Segmented
            label="Milestone"
            value={milestone}
            onChange={setMilestone}
            options={MILESTONES.map((m) => ({ value: m.id, label: m.label }))}
          />

          {milestone === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Date"
                type="date"
                value={customDate}
                min={today}
                onChange={(e) => setCustomDate(e.target.value)}
              />
              <Field
                label="Label"
                type="text"
                value={customLabel}
                maxLength={60}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="our beach trip"
              />
            </div>
          )}
        </section>
      )}

      {/* Unit toggle */}
      {hasInput && (
        <section className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-prose-faint uppercase tracking-widest font-medium">Show as</span>
          <Segmented
            label="Show as"
            value={unit}
            onChange={setUnit}
            options={UNITS.map((u) => ({ value: u.id, label: u.label }))}
          />
        </section>
      )}

      {/* Result */}
      {/* Present before the first number (one empty-result rule). */}
      {result && hasInput ? (
        <Result
          result={result}
          isAuthenticated={isAuthenticated}
          selectedKid={selectedKid}
          adhocName={adhocName}
          adhocBirthdate={adhocBirthdate}
          milestone={milestone}
          unit={unit}
          customDate={milestone === 'custom' ? customDate : undefined}
          customLabel={milestone === 'custom' ? customLabel : undefined}
        />
      ) : (
        <ResultCard
          label={`${LABELS.tools.units[unit]} left`}
          voice="Pick a birthdate and your number shows up here."
        />
      )}

    </div>
  )
}
