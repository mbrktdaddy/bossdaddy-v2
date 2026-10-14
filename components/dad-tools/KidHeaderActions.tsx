'use client'

// Client island for kid-page header: Edit + Delete, with the inline
// KidProfileForm rendered as a modal-ish panel when editing.
//
// Lifted out of KidCard so the new kid profile page can reuse the same
// edit/delete behavior without inheriting the rest of KidCard's chrome.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteKid, type Kid } from '@/lib/dad-tools/kid-actions'
import KidProfileForm from './KidProfileForm'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Modal } from '@/components/ui/Modal'

interface Props {
  kid: Kid
}

export default function KidHeaderActions({ kid }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirmingDelete) { setConfirmingDelete(true); return }
    startTransition(async () => {
      const result = await deleteKid(kid.id)
      if (result.ok) {
        // Kid no longer exists — bounce back to the hub.
        router.push('/tools')
        router.refresh()
        return
      }
      setConfirmingDelete(false)
    })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm text-prose-faint hover:text-prose px-3 py-1.5 rounded-lg border border-soft hover:border-strong transition-colors"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            confirmingDelete
              ? 'bg-danger-bg text-danger-ink border-danger-line hover:bg-danger-line'
              : 'text-prose-faint border-soft hover:text-danger-ink hover:border-danger-line'
          }`}
        >
          {pending ? '…' : confirmingDelete ? 'Confirm remove' : 'Remove'}
        </button>
      </div>

      {/* Edit form — fixed overlay so it doesn't compress the header's flex
          row when expanded. Backdrop closes the panel on click. */}
      {editing && (
        <Modal onClose={() => setEditing(false)} label="Edit kid" className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <Eyebrow>
                Edit kid
              </Eyebrow>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Close"
                className="text-prose-faint hover:text-prose text-lg leading-none p-1"
              >
                ×
              </button>
            </div>
            <KidProfileForm
              mode="edit"
              kid={kid}
              isAuthenticated
              onSuccess={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
        </Modal>
      )}
    </>
  )
}
