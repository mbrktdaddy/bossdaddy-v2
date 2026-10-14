'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/Button'
import { Modal, CloseButton } from '@/components/ui/Modal'

interface Props {
  onClose: () => void
  returnPath: string
  /** What the reader tried to do: vote on a Radar item, or follow a Bench item. */
  intent: 'vote' | 'follow'
}

// Each promise matches what the action really does. A vote asks for a test and
// also follows the item (followChangeForVote), so both promise the email. The
// vote copy says so BEFORE a new member signs up: guardrail 1.
const COPY = {
  vote: {
    title: 'Join to vote',
    body:  'Create a free account to tell Boss Daddy what to test next, and get an email when he tests it.',
  },
  follow: {
    title: 'Join to follow',
    body:  "Create a free account and Boss Daddy will email you when the review's out.",
  },
} as const

export function LoginPromptModal({ onClose, returnPath, intent }: Props) {
  const copy = COPY[intent]
  return (
    <Modal onClose={onClose} labelledBy="login-modal-title" size="sm" className="relative p-6">
        <CloseButton onClick={onClose} className="absolute top-4 right-4" />

        <div className="text-center">
          {/* A solid chrome block, not the round tinted avatar it was — the blocks lane
              (brand-guide §10.1): black panels at brand moments, never a wash. */}
          <div className="w-12 h-12 rounded-md bg-chrome text-white flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>

          <h2 id="login-modal-title" className="font-display font-black uppercase text-lg leading-tight text-prose mb-1">{copy.title}</h2>
          <p className="text-sm text-prose-muted mb-6">{copy.body}</p>

          <div className="space-y-3">
            <Link
              href={`/register?next=${encodeURIComponent(returnPath)}`}
              className={buttonVariants({ className: 'w-full' })}
            >
              Create free account
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(returnPath)}`}
              className={buttonVariants({ variant: 'outline', className: 'w-full' })}
            >
              Log in
            </Link>
          </div>
        </div>
    </Modal>
  )
}
