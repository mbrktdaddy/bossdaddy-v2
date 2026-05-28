'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addKid, updateKid, type Kid } from '@/lib/dad-tools/kid-actions'

type AddProps = {
  mode: 'add'
  onSuccess?: (kidId: string) => void
  onCancel?: () => void
}

type EditProps = {
  mode: 'edit'
  kid: Kid
  onSuccess?: () => void
  onCancel?: () => void
}

type Props = AddProps | EditProps

export default function KidProfileForm(props: Props) {
  const router = useRouter()
  const isEdit = props.mode === 'edit'
  const initialKid = isEdit ? props.kid : null

  const [name, setName]           = useState(initialKid?.name ?? '')
  const [birthdate, setBirthdate] = useState(initialKid?.birthdate ?? '')
  const [error, setError]         = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!birthdate) {
      setError('Birthdate required')
      return
    }

    startTransition(async () => {
      if (isEdit) {
        const result = await updateKid({
          id: initialKid!.id,
          name: name.trim() || null,
          birthdate,
        })
        if (!result.ok) { setError(result.error); return }
        router.refresh()
        ;(props as EditProps).onSuccess?.()
      } else {
        const result = await addKid({
          name: name.trim() || null,
          birthdate,
        })
        if (!result.ok) { setError(result.error); return }
        router.refresh()
        ;(props as AddProps).onSuccess?.(result.data?.id ?? '')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-prose-faint uppercase tracking-widest mb-1.5">
          Name <span className="lowercase text-prose-faint normal-case font-normal tracking-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={name}
          maxLength={80}
          onChange={(e) => { setName(e.target.value); setError(null) }}
          placeholder="Mason"
          className="w-full px-3 py-2.5 bg-surface-sunken border border-strong focus:border-accent rounded-xl text-prose text-sm placeholder:text-prose-faint focus:outline-none transition-colors"
          autoComplete="off"
        />
      </div>

      <div>
        <label className="block text-xs text-prose-faint uppercase tracking-widest mb-1.5">
          Birthdate
        </label>
        <input
          type="date"
          value={birthdate}
          required
          onChange={(e) => { setBirthdate(e.target.value); setError(null) }}
          max={new Date().toISOString().slice(0, 10)}
          className="w-full px-3 py-2.5 bg-surface-sunken border border-strong focus:border-accent rounded-xl text-prose text-sm placeholder:text-prose-faint focus:outline-none transition-colors"
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={pending || !birthdate}
          className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {pending ? 'Saving…' : isEdit ? 'Save' : 'Add kid'}
        </button>
        {props.onCancel && (
          <button
            type="button"
            onClick={props.onCancel}
            className="px-4 py-2.5 text-prose-faint hover:text-prose text-sm font-medium rounded-xl transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
