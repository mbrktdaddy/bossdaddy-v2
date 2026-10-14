'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addKid } from '@/lib/dad-tools/kid-actions'
import { addMoment } from '@/lib/dad-tools/moment-actions'
import type { Kid } from '@/lib/dad-tools/kid-actions'
import type { Milestone, Unit } from '@/lib/dad-tools/calc'
import { LABELS } from '@/lib/labels'
import YearlyCheckinOptIn from './YearlyCheckinOptIn'
import ShareMenu from './ShareMenu'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ResultCard, ResultLinks } from '@/components/dad-tools/CalculatorParts'

interface Props {
  result: {
    N: number
    headline: string
    passedHeadline: string | null
    milestone: Milestone
  }
  isAuthenticated: boolean
  selectedKid: Kid | null
  adhocName: string
  adhocBirthdate: string
  milestone: Milestone   // the user's originally-selected milestone (pre-fallback)
  unit: Unit
  customDate?: string
  customLabel?: string
}

export default function Result({
  result,
  isAuthenticated,
  selectedKid,
  adhocName,
  adhocBirthdate,
  milestone,
  unit,
  customDate,
  customLabel,
}: Props) {
  const router = useRouter()

  // After an anonymous "save kid" we hold the new id locally so the capture
  // CTA appears immediately without waiting for a navigation.
  const [savedKidId, setSavedKidId] = useState<string | null>(selectedKid?.id ?? null)
  const [savedKidName, setSavedKidName] = useState<string | null>(selectedKid?.name ?? null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saving, startSavingTransition] = useTransition()

  const [showCapture, setShowCapture] = useState(false)
  const [captureText, setCaptureText] = useState('')
  const [captureMessage, setCaptureMessage] = useState<string | null>(null)
  const [capturing, startCaptureTransition] = useTransition()

  function handleSaveKid() {
    if (savedKidId) return
    startSavingTransition(async () => {
      const r = await addKid({
        name: adhocName.trim() || null,
        birthdate: adhocBirthdate,
      })
      if (r.ok && r.data) {
        setSavedKidId(r.data.id)
        setSavedKidName(adhocName.trim() || null)
        setSaveMessage(isAuthenticated ? 'Saved to your dashboard.' : 'Saved.')
        router.refresh()
      }
    })
  }

  function handleCapture(e: React.FormEvent) {
    e.preventDefault()
    if (!savedKidId) return
    const text = captureText.trim()
    if (!text) return

    // Default the captured weekend to the most recent Saturday.
    // day = 0 (Sun) … 6 (Sat). Saturday → 0 back. Sunday → 1 back. Mon–Fri
    // need `day + 1` back to reach the prior Saturday (Mon=2, Tue=3, … Fri=6).
    const d = new Date()
    const day = d.getDay()
    const diff = day === 6 ? 0 : day === 0 ? 1 : day + 1
    d.setDate(d.getDate() - diff)
    const occurred = d.toISOString().slice(0, 10)

    startCaptureTransition(async () => {
      const r = await addMoment({
        kid_profile_id: savedKidId,
        response: text,
        moment_kind: 'weekend',
        occurred_on: occurred,
      })
      if (r.ok) {
        setCaptureText('')
        setShowCapture(false)
        setCaptureMessage(LABELS.tools.log.confirmation)
        router.refresh()
      }
    })
  }

  const kidName = savedKidName?.trim() || selectedKid?.name?.trim() || null
  const hasAdhocReady = !savedKidId && adhocBirthdate.length === 10
  const showAnonymousSaveCta = !isAuthenticated && hasAdhocReady
  const showLoggedInSaveCta  = isAuthenticated && !savedKidId && hasAdhocReady
  const canCapture = isAuthenticated && savedKidId !== null

  const links = [
    {
      eyebrow: `Next step · ${LABELS.tools.savings.spokeRole}`,
      href:  '/tools/savings',
      label: LABELS.tools.savings.full,
      note:  'Turn the number into a habit — a few dollars a day toward something they’ll remember.',
    },
    {
      eyebrow: `Next step · ${LABELS.tools.dadMath.spokeRole}`,
      href:  '/tools/dad-math',
      label: LABELS.tools.dadMath.full,
      note:  'Weekends are one clock. The college number is the other.',
    },
  ]

  return (
    <ResultCard
      label={`${LABELS.tools.units[unit]} left`}
      headline={result.N.toLocaleString()}
      subhead={result.passedHeadline ?? ''}
      voice={result.headline}
    >
      {/* Primary action */}
      <div className="space-y-3">

        {showAnonymousSaveCta && (
          <button
            type="button"
            onClick={handleSaveKid}
            disabled={saving}
            className={buttonVariants({ className: 'w-full sm:w-auto' })}
          >
            {saving ? 'Saving…' : 'Save this kid to your Boss Daddy dashboard'}
          </button>
        )}

        {showLoggedInSaveCta && (
          <button
            type="button"
            onClick={handleSaveKid}
            disabled={saving}
            className={buttonVariants({ className: 'w-full sm:w-auto' })}
          >
            {saving ? 'Saving…' : 'Save this kid to your dashboard'}
          </button>
        )}

        {saveMessage && !isAuthenticated && (
          <p className="text-sm text-prose">
            {saveMessage}{' '}
            <Link
              href="/register?next=/account"
              className="text-accent-text hover:underline font-semibold"
            >
              Create an account
            </Link>{' '}
            to see it in your dashboard.
          </p>
        )}

        {saveMessage && isAuthenticated && (
          <p className="text-sm text-prose">{saveMessage}</p>
        )}

        {/* Capture CTA / form (logged-in only) */}
        {canCapture && !showCapture && (
          <button
            type="button"
            onClick={() => setShowCapture(true)}
            className={buttonVariants({ className: 'w-full sm:w-auto' })}
          >
            {LABELS.tools.log.captureWeekendCta}
          </button>
        )}

        {canCapture && showCapture && (
          <form onSubmit={handleCapture} className="space-y-2.5">
            <Field
              as="textarea"
              label="What happened this weekend"
              hideLabel
              value={captureText}
              rows={3}
              maxLength={2000}
              autoFocus
              onChange={(e) => setCaptureText(e.target.value)}
              placeholder={
                kidName
                  ? `What happened this weekend with ${kidName}?`
                  : 'What happened this weekend?'
              }
              controlClassName="resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={capturing || captureText.trim().length === 0}
                className={buttonVariants()}
              >
                {capturing ? 'Capturing…' : 'Capture'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCapture(false); setCaptureText('') }}
                className={buttonVariants({ variant: 'outline' })}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {captureMessage && (
          <p className="text-sm text-prose">{captureMessage}</p>
        )}

      </div>

      {/* Yearly check-in opt-in — only when we have a saved kid to anchor it.
          Anonymous-with-no-saved-kid path: save the kid first, then this shows. */}
      {savedKidId && (
        <div className="pt-4 border-t border-soft">
          <YearlyCheckinOptIn
            kidProfileId={savedKidId}
            fallbackBirthdate={adhocBirthdate || selectedKid?.birthdate || ''}
          />
        </div>
      )}

      {/* Share menu — copy link / send to spouse / native share */}
      <div className="pt-4 border-t border-soft">
        <ShareMenu
          N={result.N}
          unit={unit}
          milestone={milestone}
          birthdate={adhocBirthdate || selectedKid?.birthdate || ''}
          kidName={kidName}
          customDate={customDate}
          customLabel={customLabel}
        />
      </div>

      <ResultLinks links={links} />
    </ResultCard>
  )
}
