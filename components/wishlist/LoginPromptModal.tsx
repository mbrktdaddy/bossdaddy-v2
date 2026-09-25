'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/Button'
import { Modal, CloseButton } from '@/components/ui/Modal'

interface Props {
  onClose: () => void
  returnPath: string
}

export function LoginPromptModal({ onClose, returnPath }: Props) {
  return (
    <Modal onClose={onClose} labelledBy="login-modal-title" size="sm" className="relative p-6">
        <CloseButton onClick={onClose} className="absolute top-4 right-4" />

        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-accent-tint border border-accent-border/50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-accent-text-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>

          <h3 id="login-modal-title" className="text-lg font-black mb-1">Join to vote</h3>
          <p className="text-sm text-prose-muted mb-6">
            Create a free account to vote on what Boss Daddy reviews next and get notified when it&apos;s live.
          </p>

          <div className="space-y-3">
            <Link
              href={`/register?next=${encodeURIComponent(returnPath)}`}
              className={buttonVariants({ className: 'w-full' })}
            >
              Create free account
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(returnPath)}`}
              className={buttonVariants({ variant: 'secondary', className: 'w-full' })}
            >
              Log in
            </Link>
          </div>
        </div>
    </Modal>
  )
}
