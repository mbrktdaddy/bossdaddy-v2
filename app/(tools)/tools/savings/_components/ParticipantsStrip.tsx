// Compact participants strip for the goal detail page. Shows avatar circles
// + names of everyone in the goal. Only renders on multi-participant goals
// (single-owner goals don't need this since the header already says
// "Personal savings"). Owner sees an "Invite" CTA inline.

import Link from 'next/link'

export interface ParticipantDisplay {
  userId:       string
  displayName:  string
  avatarUrl:    string | null
  role:         'owner' | 'contributor'
  isCurrent:    boolean
}

interface Props {
  goalId:        string
  participants:  ParticipantDisplay[]
  isOwner:       boolean
}

export default function ParticipantsStrip({ goalId, participants, isOwner }: Props) {
  // Skip the strip on solo goals — header eyebrow already says "Personal."
  if (participants.length < 2 && !isOwner) return null
  if (participants.length < 2 && isOwner) {
    // Solo owner — show only the invite CTA, not the avatar strip
    return (
      <section className="bg-surface border border-soft rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-sm text-prose-muted">
          Make this a shared goal — invite your partner.
        </p>
        <Link
          href={`/tools/savings/${goalId}/invite`}
          className="shrink-0 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg text-xs transition-colors"
        >
          + Invite
        </Link>
      </section>
    )
  }

  return (
    <section className="bg-surface border border-soft rounded-xl px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-[10px] text-prose-faint uppercase tracking-widest font-semibold shrink-0">
          Shared with
        </p>
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          {participants.map((p) => {
            const initial = (p.displayName.trim()?.[0] ?? '?').toUpperCase()
            return (
              <div
                key={p.userId}
                className="flex items-center gap-1.5"
                title={`${p.displayName}${p.role === 'owner' ? ' (owner)' : ''}${p.isCurrent ? ' (you)' : ''}`}
              >
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatarUrl}
                    alt=""
                    className={`h-7 w-7 rounded-full object-cover bg-surface-sunken shrink-0 ${p.isCurrent ? 'ring-2 ring-accent' : ''}`}
                  />
                ) : (
                  <div
                    className={`h-7 w-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-black shrink-0 ${p.isCurrent ? 'ring-2 ring-accent' : ''}`}
                    aria-hidden="true"
                  >
                    {initial}
                  </div>
                )}
                <span className="text-xs text-prose-muted truncate max-w-[120px]">
                  {p.isCurrent ? 'You' : p.displayName}
                </span>
              </div>
            )
          })}
        </div>
        {isOwner && (
          <Link
            href={`/tools/savings/${goalId}/invite`}
            className="shrink-0 text-xs font-semibold text-accent hover:underline"
          >
            Manage →
          </Link>
        )}
      </div>
    </section>
  )
}
