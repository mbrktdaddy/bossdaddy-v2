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

  return (
    <section className="bg-surface border border-faint rounded-3xl p-6 sm:p-10 space-y-6">

      {result.passedHeadline && (
        <p className="text-sm text-prose-faint italic">
          {result.passedHeadline}
        </p>
      )}

      <div>
        <p className="text-7xl sm:text-8xl font-black text-accent leading-none tracking-tight">
          {result.N.toLocaleString()}
        </p>
        <p className="text-lg sm:text-xl text-prose mt-4 leading-snug max-w-prose">
          {result.headline}
        </p>
      </div>

      {/* Primary action */}
      <div className="space-y-3 pt-2">

        {showAnonymousSaveCta && (
          <button
            type="button"
            onClick={handleSaveKid}
            disabled={saving}
            className="w-full sm:w-auto px-5 py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : 'Save this kid to your Boss Daddy dashboard'}
          </button>
        )}

        {showLoggedInSaveCta && (
          <button
            type="button"
            onClick={handleSaveKid}
            disabled={saving}
            className="w-full sm:w-auto px-5 py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : 'Save this kid to your dashboard'}
          </button>
        )}

        {saveMessage && !isAuthenticated && (
          <p className="text-sm text-prose">
            {saveMessage}{' '}
            <a
              href="/register?next=/account/settings"
              className="text-accent hover:underline font-semibold"
            >
              Create an account
            </a>{' '}
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
            className="w-full sm:w-auto px-5 py-3 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {LABELS.tools.log.captureWeekendCta}
          </button>
        )}

        {canCapture && showCapture && (
          <form onSubmit={handleCapture} className="space-y-2.5">
            <textarea
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
              className="w-full px-3 py-2.5 bg-surface-sunken border border-strong focus:border-accent rounded-xl text-prose text-sm placeholder:text-prose-faint focus:outline-none transition-colors resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={capturing || captureText.trim().length === 0}
                className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {capturing ? 'Capturing…' : 'Capture'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCapture(false); setCaptureText('') }}
                className="px-4 py-2.5 text-prose-faint hover:text-prose text-sm rounded-xl transition-colors"
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
        <div className="pt-4 border-t border-faint">
          <YearlyCheckinOptIn
            kidProfileId={savedKidId}
            fallbackBirthdate={adhocBirthdate || selectedKid?.birthdate || ''}
          />
        </div>
      )}

      {/* Share menu — copy link / send to spouse / native share */}
      <div className="pt-4 border-t border-faint">
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

    </section>
  )
}
