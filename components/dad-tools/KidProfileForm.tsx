'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addKid, updateKid, type Kid, type MemberType } from '@/lib/dad-tools/kid-actions'
import { familyPhotoSrc } from '@/lib/dad-tools/family-photo'
import { LABELS } from '@/lib/labels'
import KidPhotoUploader from './KidPhotoUploader'
import { buttonVariants } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { PILL_BASE, PILL_ACTIVE, PILL_INACTIVE } from '@/components/ui/PillFilterStrip'

const MEMBER_TYPES: MemberType[] = ['child', 'partner', 'other']
const NAME_PLACEHOLDER: Record<MemberType, string> = {
  child:   'Mason',
  partner: 'Jordan',
  other:   'Name',
}

type AddProps = {
  mode: 'add'
  isAuthenticated?: boolean
  onSuccess?: (kidId: string) => void
  onCancel?: () => void
}

type EditProps = {
  mode: 'edit'
  kid: Kid
  isAuthenticated?: boolean
  onSuccess?: () => void
  onCancel?: () => void
}

type Props = AddProps | EditProps

export default function KidProfileForm(props: Props) {
  const router = useRouter()
  const isEdit = props.mode === 'edit'
  const initialKid = isEdit ? props.kid : null

  const [name, setName]             = useState(initialKid?.name ?? '')
  const [birthdate, setBirthdate]   = useState(initialKid?.birthdate ?? '')
  const [memberType, setMemberType] = useState<MemberType>(initialKid?.member_type ?? 'child')
  const [error, setError]           = useState<string | null>(null)
  const [pending, startTransition]  = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (memberType === 'child' && !birthdate) {
      setError('A birthdate is required for a child')
      return
    }

    startTransition(async () => {
      if (isEdit) {
        const result = await updateKid({
          id: initialKid!.id,
          name: name.trim() || null,
          birthdate: birthdate || null,
          member_type: memberType,
        })
        if (!result.ok) { setError(result.error); return }
        router.refresh()
        ;(props as EditProps).onSuccess?.()
      } else {
        const result = await addKid({
          name: name.trim() || null,
          birthdate: birthdate || null,
          member_type: memberType,
        })
        if (!result.ok) { setError(result.error); return }
        router.refresh()
        ;(props as AddProps).onSuccess?.(result.data?.id ?? '')
      }
    })
  }

  // Edit-mode photo uploader. Anonymous viewers can't upload (no durable
  // identity on the server) — the uploader renders a soft "sign up" hint.
  // Add mode has no kidId yet; show a hint instead so the dad knows where
  // photo upload lives.
  const photoInitial = (isEdit && initialKid?.name?.trim()?.[0] ? initialKid.name.trim()[0] : '?').toUpperCase()
  const isAuthenticated = !!props.isAuthenticated

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {isEdit && initialKid && (
        <div className="pb-3 border-b border-soft mb-1">
          <KidPhotoUploader
            kidId={initialKid.id}
            initialPhotoUrl={familyPhotoSrc(initialKid)}
            initial={photoInitial}
            canUpload={isAuthenticated}
          />
        </div>
      )}

      <div>
        <p id="kid-who" className="block mb-1.5 text-sm font-semibold text-prose">Who is this?</p>
        <div role="radiogroup" aria-labelledby="kid-who" className="grid grid-cols-3 gap-2">
          {MEMBER_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={memberType === t}
              onClick={() => { setMemberType(t); setError(null) }}
              className={`${PILL_BASE} justify-center ${memberType === t ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              {LABELS.tools.kids.memberType[t]}
            </button>
          ))}
        </div>
      </div>

      <Field
        label={<>Name <span className="font-normal text-prose-faint">(optional)</span></>}
        type="text"
        value={name}
        maxLength={80}
        onChange={(e) => { setName(e.target.value); setError(null) }}
        placeholder={NAME_PLACEHOLDER[memberType]}
        autoComplete="off"
      />

      <Field
        label={<>Birthdate{memberType !== 'child' && <span className="font-normal text-prose-faint"> (optional)</span>}</>}
        type="date"
        value={birthdate}
        required={memberType === 'child'}
        onChange={(e) => { setBirthdate(e.target.value); setError(null) }}
        max={new Date().toISOString().slice(0, 10)}
        hint={memberType !== 'child' ? `Optional for a ${LABELS.tools.kids.memberType[memberType].toLowerCase()} — add one only if you want birthday reminders.` : undefined}
      />

      {error && <p className="text-sm text-danger-ink">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={pending || (memberType === 'child' && !birthdate)}
          className={buttonVariants()}
        >
          {pending ? 'Saving…' : isEdit ? 'Save' : 'Add to family'}
        </button>
        {props.onCancel && (
          <button
            type="button"
            onClick={props.onCancel}
            className={buttonVariants({ variant: 'ghost' })}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
