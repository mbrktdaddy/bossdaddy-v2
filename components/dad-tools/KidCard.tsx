'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deleteKid, type Kid } from '@/lib/dad-tools/kid-actions'
import { logTitle } from '@/lib/labels'
import {
  ageInYearsMonths,
  milestoneDate,
  weeksUntil,
} from '@/lib/dad-tools/calc'
import type { KidMoment } from '@/lib/dad-tools/moment-actions'
import KidProfileForm from './KidProfileForm'
import CaptureMomentForm from './CaptureMomentForm'
import MomentsFeed from './MomentsFeed'

interface Props {
  kid: Kid
  initialMoments: KidMoment[]
  momentCount: number
  isAuthenticated: boolean
}

export default function KidCard({ kid, initialMoments, momentCount, isAuthenticated }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [capturing, setCapturing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  const { years, months } = ageInYearsMonths(kid.birthdate)
  const until18    = milestoneDate('until_18',      kid.birthdate)
  const untilNextBday = milestoneDate('next_birthday', kid.birthdate)

  const weekendsUntil18    = until18 ? weeksUntil(until18) : 0
  const weekendsUntilBday  = untilNextBday ? weeksUntil(untilNextBday) : 0
  const past18 = weekendsUntil18 === 0

  function handleDelete() {
    if (!confirmingDelete) { setConfirmingDelete(true); return }
    startTransition(async () => {
      const result = await deleteKid(kid.id)
      if (result.ok) router.refresh()
      setConfirmingDelete(false)
    })
  }

  const ageLabel = years === 0
    ? `${months} ${months === 1 ? 'month' : 'months'} old`
    : months === 0
      ? `${years} ${years === 1 ? 'year' : 'years'} old`
      : `${years}y ${months}m`

  const displayName = kid.name?.trim() || 'Your kid'
  const initial = (kid.name?.trim()?.[0] ?? '?').toUpperCase()

  return (
    <article className="bg-surface border border-faint rounded-2xl p-4 sm:p-5 space-y-4">

      {/* Header: avatar + name + age */}
      <header className="flex items-start gap-3">
        {kid.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={kid.photo_url}
            alt=""
            className="h-12 w-12 rounded-full object-cover bg-surface-sunken shrink-0"
          />
        ) : (
          <div
            className="h-12 w-12 rounded-full bg-accent/15 text-accent flex items-center justify-center text-lg font-black shrink-0"
            aria-hidden="true"
          >
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-prose truncate">
            <Link
              href={`/tools/kids/${kid.id}`}
              className="hover:text-accent transition-colors"
            >
              {displayName}
            </Link>
          </h3>
          <p className="text-xs text-prose-faint">{ageLabel}</p>
        </div>
        {mode === 'view' && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className="text-xs text-prose-faint hover:text-prose px-2 py-1.5 rounded-md transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className={`text-xs px-2 py-1.5 rounded-md transition-colors ${
                confirmingDelete
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'text-prose-faint hover:text-red-700'
              }`}
            >
              {pending ? '…' : confirmingDelete ? 'Confirm' : 'Remove'}
            </button>
          </div>
        )}
      </header>

      {/* Inline edit form */}
      {mode === 'edit' && (
        <div className="border-t border-faint pt-4">
          <KidProfileForm
            mode="edit"
            kid={kid}
            onSuccess={() => setMode('view')}
            onCancel={() => setMode('view')}
          />
        </div>
      )}

      {/* Numbers strip — Until-18 stat doubles as the link into Weekends Until,
          prefilled with this kid's data. */}
      {mode === 'view' && (
        <div className="grid grid-cols-2 gap-3">
          {past18 ? (
            <Stat value="—" label="Out of the house" />
          ) : (
            <Link
              href={`/tools/weekends-until?kid=${kid.id}&birthdate=${kid.birthdate}&milestone=until_18&unit=weekends${kid.name ? `&for=${encodeURIComponent(kid.name.charAt(0))}` : ''}`}
              className="block bg-surface-sunken hover:bg-accent/5 rounded-xl px-3 py-2.5 transition-colors group"
              title="See the full breakdown in Weekends Until"
            >
              <p className="text-2xl font-black text-prose group-hover:text-accent leading-tight transition-colors">
                {weekendsUntil18}
              </p>
              <p className="text-xs text-prose-faint mt-0.5 group-hover:text-accent-text-soft transition-colors">
                weekends until 18 →
              </p>
            </Link>
          )}
          <Stat
            value={weekendsUntilBday}
            label={`weekends until ${years + 1}`}
          />
        </div>
      )}

      {/* The Log */}
      {mode === 'view' && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-eyebrow uppercase tracking-widest font-medium">
              {logTitle(kid.name)}
            </p>
            {momentCount > 0 && (
              <p className="text-xs text-prose-faint">
                {momentCount} captured
              </p>
            )}
          </div>

          {!isAuthenticated ? (
            <p className="text-sm text-prose-faint">
              <a href="/login" className="text-accent hover:underline">Sign in</a> to capture moments.
            </p>
          ) : capturing ? (
            <CaptureMomentForm
              kidProfileId={kid.id}
              kidName={kid.name}
              autoFocus
              onSuccess={() => setCapturing(false)}
              onCancel={() => setCapturing(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setCapturing(true)}
              className="w-full text-left px-3 py-2.5 bg-surface-sunken border border-faint border-dashed hover:border-accent hover:bg-accent/5 rounded-xl text-sm text-prose-faint hover:text-prose transition-colors"
            >
              Capture a moment
            </button>
          )}

          {isAuthenticated && initialMoments.length > 0 && (
            <MomentsFeed moments={initialMoments} />
          )}
        </div>
      )}

    </article>
  )
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-surface-sunken rounded-xl px-3 py-2.5">
      <p className="text-2xl font-black text-prose leading-tight">{value}</p>
      <p className="text-xs text-prose-faint mt-0.5">{label}</p>
    </div>
  )
}
