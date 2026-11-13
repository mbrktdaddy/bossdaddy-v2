// Your corner — the people actually watching one of your goals.
//
// DERIVED, NOT STORED, and that's the whole point. This started life as a list of
// every accepted connection, which made "in your corner" mean "anyone I can
// message" — so a dad you swap gear opinions with sat under the same heading as
// the wife who witnesses your taper. The brand uses the phrase for someone who
// has your back on something specific, and this is the set that actually matches
// it: `goal_participants` across the goals you own.
//
// WHY NOT A SECOND CONNECTION TIER. The obvious alternative was a close-friend /
// acquaintance axis on user_connections. Rejected: the gradation that matters is
// already PER GOAL (cheer < witness < teammate, migration 137), which is strictly
// more precise than a global label, and two answers to the same question
// eventually disagree about the same person. A contact is who you CAN ask; your
// corner is who said yes, and to what.
//
// Read with the caller's client — RLS scopes goal_participants to goals he owns.

import Link from 'next/link'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { TIER_COPY, type ShareTier } from '@/lib/goals/participants'
import { LABELS } from '@/lib/labels'
import { UtilityBox, StatusChip } from '@/components/ui/UtilityBox'

type Row = {
  goal_id: string
  user_id: string
  tier: ShareTier
  profiles: { username: string | null; display_name: string | null } | null
}

/**
 * The other direction: goals OTHER people have shared with YOU.
 *
 * The corner section answers "who's backing me"; this answers "who am I backing".
 * Without it /account was asymmetric — you could see everyone keeping you honest
 * and had no way to reach the goals you'd agreed to watch, even though accepting
 * an invite is how most people meet this feature at all.
 *
 * Counted against the definer view, which returns nothing unless you're actually
 * a participant, so this costs no rows.
 *
 * `asListItem` renders it as the last `<li>` of the populated list; otherwise it is
 * a `border-t` block under the empty-state copy.
 */
async function BackingLink({ asListItem = false }: { asListItem?: boolean }) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('goal_share_summary')
    .select('goal_id', { count: 'exact', head: true })
  if (!count) return null

  const link = (
    <Link
      href="/goals#corner"
      className="flex items-center justify-center px-4 min-h-[44px] font-display font-extrabold text-[11px] uppercase tracking-[0.1em] text-accent-text hover:text-prose transition-colors"
    >
      {LABELS.goals.sharedHeading}
      <span className="ml-1.5 font-sans font-normal normal-case tracking-normal text-prose-faint"> · {count} shared with you</span>
    </Link>
  )

  return asListItem ? <li>{link}</li> : <div className="border-t border-soft">{link}</div>
}

export default async function YourCornerSection() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return null

  // Only goals he owns and hasn't archived — someone watching a finished goal
  // isn't currently in his corner for anything.
  const { data: goalRows } = await supabase
    .from('goals')
    .select('id, title')
    .eq('user_id', user.id)
    .in('status', ['active', 'paused'])
  const goals = new Map((goalRows ?? []).map((g) => [g.id, g.title]))

  const { data, error } = goals.size > 0
    ? await supabase
        .from('goal_participants')
        .select('goal_id, user_id, tier, profiles(username, display_name)')
        .in('goal_id', [...goals.keys()])
    : { data: [], error: null }
  if (error) {
    console.error('your corner: read failed —', error.message)
    return null
  }

  const rows = (data ?? []) as unknown as Row[]

  // ⚠️ RENDERS EVEN WHEN EMPTY, and that is the point.
  //
  // This first shipped returning null with nobody in the corner, which is tidier
  // and completely wrong for this codebase: a section that only appears once
  // you're already using a feature can never teach you the feature exists. It's
  // the identical failure WorkingOnSection was built to fix — the goals spine
  // shipped with no presence on the one page every member visits, so the whole
  // thing was invisible from the profile. Empty space that explains itself beats
  // absence.
  //
  // Two different empty states, because the next action genuinely differs: with
  // no goals at all there is nothing to share yet, and telling him to invite
  // someone would be advice he can't take.
  if (rows.length === 0) {
    return (
      <UtilityBox label={LABELS.contacts.cornerLabel} count={null}>
        <div className="p-4">
          {goals.size === 0 ? (
            <>
              <p className="text-sm text-prose-faint leading-snug">
                Nobody yet. Start something you want to stick to, then you can ask
                someone to keep you honest about it.
              </p>
              <Link
                href="/goals/new"
                className="mt-3 inline-flex min-h-11 items-center font-display font-extrabold text-[11px] uppercase tracking-[0.1em] text-accent-text hover:text-prose transition-colors"
              >
                {LABELS.goals.newCta}
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-prose-faint leading-snug">
                Nobody yet. Pick a goal and invite someone — they can see how it&apos;s
                going without ever being told about a day you missed, and either of
                you can end it whenever.
              </p>
              {/* Names the next step, not the end state — /goals is a list, and
                  "Share a goal" implied it would take you somewhere you could
                  immediately do that. Every row there now carries its own share
                  control, so picking one IS the action. */}
              <Link
                href="/goals"
                className="mt-3 inline-flex min-h-11 items-center font-display font-extrabold text-[11px] uppercase tracking-[0.1em] text-accent-text hover:text-prose transition-colors"
              >
                Pick a goal to share
              </Link>
            </>
          )}
        </div>
        <BackingLink />
      </UtilityBox>
    )
  }

  // Group by PERSON, not by goal. "Kim is witnessing two of your goals" is the
  // sentence he wants; a per-goal list would repeat her name and bury the point.
  const byPerson = new Map<string, { label: string; entries: { goalId: string; title: string; tier: ShareTier }[] }>()
  for (const r of rows) {
    const label = r.profiles?.display_name?.trim()
      || (r.profiles?.username ? `@${r.profiles.username}` : 'A member')
    const bucket = byPerson.get(r.user_id) ?? { label, entries: [] }
    bucket.entries.push({ goalId: r.goal_id, title: goals.get(r.goal_id) ?? 'a goal', tier: r.tier })
    byPerson.set(r.user_id, bucket)
  }

  const people = [...byPerson.values()].sort((a, b) => a.label.localeCompare(b.label))

  return (
    <UtilityBox label={LABELS.contacts.cornerLabel} count={people.length > 0 ? people.length : null}>
      <p className="px-4 pt-3 pb-2 text-xs text-prose-faint leading-snug">
        Who&apos;s keeping you honest, and on what. They never get notified about a
        day you missed — and you can cut any of it off from the goal itself.
      </p>

      <ul className="divide-y divide-soft">
        {people.map((person) => (
          <li key={person.label} className="px-4 py-3">
            <p className="text-sm font-bold text-prose truncate">{person.label}</p>
            <div className="mt-2 space-y-1">
              {person.entries.map((e) => (
                <Link
                  key={`${person.label}-${e.goalId}`}
                  href={`/goals/${e.goalId}/share`}
                  className="flex items-center justify-between gap-3 min-h-11 text-xs text-prose-muted hover:text-prose transition-colors"
                >
                  <span className="truncate">{e.title}</span>
                  <StatusChip tone="chrome">{TIER_COPY[e.tier].label}</StatusChip>
                </Link>
              ))}
            </div>
          </li>
        ))}
        <BackingLink asListItem />
      </ul>
    </UtilityBox>
  )
}
