// Members management, inline on the goal detail page. Shows the full roster
// with remove buttons (owner-only) and an Invite affordance. Replaces the
// compact ParticipantsStrip on the detail page so add/remove is discoverable
// without drilling into the dedicated /invite page (which still exists for
// generating + tracking invite links).

import Link from 'next/link'
import RemoveParticipantButton from '../[id]/invite/_RemoveParticipantButton'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { buttonVariants } from '@/components/ui/Button'

export interface MemberDisplay {
  userId:      string
  displayName: string
  avatarUrl:   string | null
  role:        'owner' | 'contributor'
  isCurrent:   boolean
}

interface Props {
  goalId:         string
  members:        MemberDisplay[]
  isOwner:        boolean
  seatsRemaining: number
}

export default function MembersPanel({ goalId, members, isOwner, seatsRemaining }: Props) {
  const solo = members.length < 2

  // Non-owner on a solo goal has nothing to manage here — the strip would just
  // show themselves. Hide it (their Leave control lives in its own section).
  if (solo && !isOwner) return null

  return (
    <Card as="section" className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>
          Members — {members.length} / 5
        </Eyebrow>
        {isOwner && seatsRemaining > 0 && (
          <Link
            href={`/tools/savings/${goalId}/invite`}
            className={buttonVariants({ size: 'sm', className: 'shrink-0' })}
          >
            + Invite
          </Link>
        )}
      </div>

      {solo ? (
        <p className="text-sm text-prose-muted">
          It’s just you. Invite your partner so the streak counts whenever
          <em> either</em> of you shows up.
        </p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const initial = (m.displayName.trim()?.[0] ?? '?').toUpperCase()
            return (
              <div
                key={m.userId}
                className="flex items-center gap-3 px-3 py-2.5 bg-surface-sunken border border-soft rounded-lg min-h-[44px]"
              >
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover bg-surface-sunken shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-black shrink-0" aria-hidden="true">
                    {initial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-prose truncate">
                    {m.isCurrent ? 'You' : m.displayName}
                  </p>
                  {m.role === 'owner' && (
                    <p className="text-[10px] text-prose-faint uppercase tracking-widest">Owner</p>
                  )}
                </div>
                {isOwner && m.role !== 'owner' && (
                  <RemoveParticipantButton goalId={goalId} userId={m.userId} name={m.displayName} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
