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
import { buttonVariants } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { useConfirm } from '@/components/ui/useConfirm'

interface Props {
  kid: Kid
}

export default function KidHeaderActions({ kid }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const { confirm: ask, dialog } = useConfirm()
  const [pending, startTransition] = useTransition()

  async function handleDelete() {
    const ok = await ask({
      title: `Remove ${kid.name?.trim() || 'this person'}?`,
      body: 'Their profile and every moment you captured will be deleted.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await deleteKid(kid.id)
      if (result.ok) {
        // Kid no longer exists — bounce back to the hub.
        router.push('/tools')
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={buttonVariants({ variant: 'outline', size: 'md' })}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className={buttonVariants({ variant: 'danger', size: 'md' })}
        >
          {pending ? '…' : 'Remove'}
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
              <IconButton label="Close" onClick={() => setEditing(false)} className="-mr-2">
                <span aria-hidden className="text-xl leading-none">×</span>
              </IconButton>
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
      {dialog}
    </>
  )
}
