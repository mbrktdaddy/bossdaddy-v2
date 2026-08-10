// Who can see this goal — the owner's side of accountability partners.
//
// The mechanic is deliberately narrow: a partner can LOOK, and that's it. Nobody
// gets notified about anybody, in either direction, because "your wife gets a push
// when you miss your meds" is a surveillance product and this isn't one. See
// migration 137's header for the full reasoning, including why honest logging is
// the thing that breaks first if you get this wrong.
//
// No client JavaScript: plain forms POSTing to /api/goals/share.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/og'
import { LABELS } from '@/lib/labels'
import { LoginLink } from '@/components/LoginLink'
import {
  listParticipants, listInvitations, TIER_COPY, TIERS, type ShareTier,
  THREAD_ACCESS, THREAD_ACCESS_COPY, type ThreadAccess,
} from '@/lib/goals/participants'
import { listGoalContacts } from '@/lib/goals/contacts'
import { countNotes } from '@/lib/goals/notes'

export const metadata: Metadata = {
  title: `Sharing — ${LABELS.goals.short}`,
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ msg?: string; token?: string; sent?: string }>
}

export default async function GoalSharePage({ params, searchParams }: Props) {
  const { id } = await params
  const { msg, token, sent } = await searchParams

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) {
    return (
      <Wrap>
        <h1 className="text-2xl font-black text-prose">Sign in to share a goal.</h1>
        <LoginLink className="mt-6 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Sign in →
        </LoginLink>
      </Wrap>
    )
  }

  // Owner-only, filtered EXPLICITLY. This used to say "RLS: only the owner reads a
  // goal here" and lean on that — untrue since migration 137 gave teammates base
  // -table read, which would have let a teammate open the SHARING screen for
  // somebody else's goal. A goal that isn't his is a 404; the reader's own view of
  // a shared goal is /goals/shared/[id].
  const { data: goalRow } = await supabase
    .from('goals')
    .select('id, title, config')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  const goal = goalRow as { id: string; title: string; config: { sensitive?: unknown } | null } | null
  if (!goal) notFound()

  const sensitive = goal.config?.sensitive === true

  const [participants, invitations, contacts, noteCount] = await Promise.all([
    listParticipants(supabase, goal.id),
    listInvitations(supabase, goal.id),
    listGoalContacts(supabase, { userId: user.id, goalId: goal.id }),
    // The number in the exposure warning. Counts the WHOLE feed, not just his own
    // notes, because granting access exposes the whole feed — see countNotes.
    countNotes(supabase, { type: 'goal', id: goal.id }),
  ])
  const pending = invitations.filter((i) => i.state === 'pending')

  // Shown once, right after minting. The link is the delivery mechanism on
  // purpose: he sends it however he likes, so we never put a cessation goal in
  // someone's inbox without him choosing to.
  // ABSOLUTE, not a path. This link's whole job is to leave the app — into a text
  // message, a WhatsApp thread, an email he writes himself. A bare "/goals/invite/…"
  // pasted anywhere off-site is dead on arrival. Same canonical SITE_URL the
  // calendar feed builds from; set NEXT_PUBLIC_SITE_URL locally if you want the
  // copied link to point at your dev server instead of production.
  const inviteUrl = (t: string) => `${SITE_URL}/goals/invite/${t}`
  const freshLink = token ? inviteUrl(token) : null

  return (
    <Wrap>
      <Link href={`/goals/${goal.id}`} className="inline-flex items-center py-3 text-xs text-muted hover:text-prose">
        ← {goal.title}
      </Link>

      <header className="mt-4 space-y-2">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">Sharing</p>
        {/* Matches the link that got you here. Landing on a different noun than
            the button you pressed is its own small confusion, and this page is
            reached from three places now. */}
        <h1 className="text-2xl sm:text-3xl font-black text-prose leading-tight tracking-tight">
          {LABELS.goals.shareCta}
        </h1>
        <p className="text-sm text-prose-muted leading-snug">
          Someone in your corner makes this stick. They can look — they never get
          pinged about a day you missed, and you can cut it off any time.
        </p>
      </header>

      {msg ? (
        <p className="mt-6 rounded-lg border border-strong bg-surface-raised px-4 py-3 text-sm text-accent-text">
          {msg.slice(0, 220)}
        </p>
      ) : null}

      {freshLink ? (
        <div className="mt-6 rounded-xl border border-strong bg-surface-raised p-5">
          <p className="text-sm font-semibold text-prose">
            {sent === 'member' ? 'Sent. He\'ll see it in the app and in his inbox.'
              : sent === 'email' ? 'Sent. It\'s on its way to their inbox.'
              : 'Invite ready. Send him this:'}
          </p>
          {/* Selectable text rather than a copy button — a button needs client JS,
              and long-press-to-copy is native on the phone this is built for. Shown
              even when we sent it: mail gets filtered, and this is the fallback. */}
          <p className="mt-3 break-all rounded-lg border border-soft bg-surface px-4 py-3 font-mono text-xs text-accent-text">
            {freshLink}
          </p>
          <p className="mt-2 text-xs text-faint">
            {sent === 'none'
              ? 'Good for 7 days, one use. Nothing was emailed — that\'s your call to make.'
              : 'Good for 7 days, one use. Here it is as well, in case you\'d rather text it.'}
          </p>
        </div>
      ) : null}

      {/* ── who's in ────────────────────────────────────────────────────────── */}
      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-bold text-prose uppercase tracking-wide">In your corner</h2>

        {participants.length === 0 ? (
          <p className="text-sm text-faint">
            Nobody yet. This goal is yours alone.
          </p>
        ) : participants.map((p) => (
          <div key={p.id} className="rounded-xl border border-soft bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-prose truncate">
                  {p.displayName?.trim() || p.username || 'A member'}
                </p>
                <p className="mt-1 text-xs text-muted">{TIER_COPY[p.tier].label}</p>
                <p className="mt-1 text-xs text-faint">{TIER_COPY[p.tier].sees}</p>
                {/* Stated separately from the tier because it IS separate — and
                    because "can he read my notes?" is the question an owner will
                    want answered at a glance. */}
                <p className="mt-1 text-xs text-faint">
                  {THREAD_ACCESS_COPY[p.threadAccess].sees}
                </p>
              </div>
              {/* Revoke. Silent by design — see migration 137. */}
              <form action="/api/goals/share" method="post" className="shrink-0">
                <input type="hidden" name="op" value="end_share" />
                <input type="hidden" name="goalId" value={goal.id} />
                <input type="hidden" name="participantUserId" value={p.userId} />
                <button
                  type="submit"
                  className="min-h-11 rounded-lg border border-soft bg-surface px-4 py-3 text-xs font-semibold text-accent-text hover:bg-surface-hover transition-colors"
                >
                  Remove
                </button>
              </form>
            </div>

            {/* Change what they see. Collapsed so it never competes with Remove. */}
            <details className="mt-4">
              <summary className="min-h-11 flex cursor-pointer items-center text-xs font-semibold text-muted hover:text-prose">
                Change what they see
              </summary>
              <form action="/api/goals/share" method="post" className="mt-3 space-y-2">
                <input type="hidden" name="op" value="set_tier" />
                <input type="hidden" name="goalId" value={goal.id} />
                <input type="hidden" name="participantUserId" value={p.userId} />
                <TierChoices current={p.tier} name={`tier-${p.id}`} />
                {/* MUST be rendered whenever this form can submit. The route
                    treats an absent field as "leave it alone" precisely so a
                    tier edit can't silently revoke feed access — but a form that
                    shows the tier and hides this would leave the owner unable to
                    ever close the feed again. */}
                <ThreadAccessChoices
                  current={p.threadAccess}
                  name={`feed-${p.id}`}
                  noteCount={noteCount}
                />
                {sensitive ? <SensitiveAck /> : null}
                <button
                  type="submit"
                  className="min-h-11 w-full rounded-lg border border-strong bg-surface px-4 py-3 text-xs font-bold text-prose hover:bg-surface-hover transition-colors"
                >
                  Save
                </button>
              </form>
            </details>
          </div>
        ))}
      </section>

      {/* ── pending invites ─────────────────────────────────────────────────── */}
      {pending.length > 0 ? (
        <section className="mt-10 space-y-3">
          <h2 className="text-sm font-bold text-prose uppercase tracking-wide">Waiting on</h2>
          {pending.map((invite) => (
            <div key={invite.id} className="flex items-start justify-between gap-4 rounded-xl border border-soft bg-surface p-5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-prose truncate">
                  {invite.email || 'Whoever you sent the link to'}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {TIER_COPY[invite.tier].label} · expires {invite.expiresAt.slice(0, 10)}
                </p>
                {/* A live invite is a bearer token for whatever it offers, so the
                    feed grant riding on it has to be visible here — otherwise the
                    only way to find out what you offered is to accept it. */}
                {invite.threadAccess !== 'none' ? (
                  <p className="mt-1 text-xs text-accent-text">
                    {THREAD_ACCESS_COPY[invite.threadAccess].label}
                  </p>
                ) : null}
                <p className="mt-2 break-all font-mono text-[11px] text-faint">
                  {inviteUrl(invite.token)}
                </p>
              </div>
              <form action="/api/goals/share" method="post" className="shrink-0">
                <input type="hidden" name="op" value="revoke_invite" />
                <input type="hidden" name="goalId" value={goal.id} />
                <input type="hidden" name="invitationId" value={invite.id} />
                <button
                  type="submit"
                  className="min-h-11 rounded-lg border border-soft bg-surface px-4 py-3 text-xs font-semibold text-muted hover:bg-surface-hover transition-colors"
                >
                  Call it back
                </button>
              </form>
            </div>
          ))}
        </section>
      ) : null}

      {/* ── invite ──────────────────────────────────────────────────────────── */}
      <section className="mt-10 border-t border-soft pt-8">
        <h2 className="text-sm font-bold text-prose uppercase tracking-wide">Add someone</h2>

        <form action="/api/goals/share" method="post" className="mt-4 space-y-5">
          <input type="hidden" name="op" value="invite" />
          <input type="hidden" name="goalId" value={goal.id} />

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-prose">What can they see?</legend>
            <TierChoices current="cheer" name="tier" />
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-prose">Can they see your notes?</legend>
            <ThreadAccessChoices current="none" name="feed" noteCount={noteCount} />
          </fieldset>

          {sensitive ? <SensitiveAck /> : null}

          {/* WHO — a name he already talks to, or an address, or neither.
              All three go through the same submit; the route decides which it
              was. A <select> can't change the form's `op` without client JS, and
              this page has none. */}
          {contacts.length > 0 ? (
            <label className="block">
              <span className="text-sm font-semibold text-prose">Someone in your corner</span>
              <select
                name="contactUserId"
                defaultValue=""
                className="mt-2 min-h-11 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
              >
                <option value="">Pick a name…</option>
                {contacts.map((c) => (
                  <option key={c.userId} value={c.userId}>{c.label}</option>
                ))}
              </select>
              <span className="mt-2 block text-xs text-faint">
                Goes straight to them — in the app and by email. No link to pass on.
              </span>
            </label>
          ) : null}

          <label className="block">
            <span className="text-sm text-muted">
              {contacts.length > 0 ? 'Or their email' : 'Their email'}
            </span>
            <input
              type="email"
              name="email"
              maxLength={200}
              className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
            />
            <span className="mt-2 block text-xs text-faint">
              We&apos;ll email them the invite. Leave it blank and you just get a link
              to send however you like.
            </span>
          </label>

          <button
            type="submit"
            className="min-h-11 w-full rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover transition-colors"
          >
            Send the invite
          </button>
        </form>
      </section>
    </Wrap>
  )
}

/** The three tiers, each spelled out. Same copy the invitee reads before accepting. */
function TierChoices({ current, name }: { current: ShareTier; name: string }) {
  return (
    <div className="space-y-2">
      {TIERS.map((tier) => (
        <label
          key={tier}
          className="flex items-start gap-3 rounded-lg border border-soft bg-surface-raised px-4 py-3"
        >
          <input
            type="radio"
            name="tier"
            value={tier}
            defaultChecked={tier === current}
            className="mt-0.5 accent-accent"
            id={`${name}-${tier}`}
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-prose">{TIER_COPY[tier].label}</span>
            <span className="mt-0.5 block text-xs text-muted">{TIER_COPY[tier].sees}</span>
            <span className="mt-0.5 block text-xs text-faint">{TIER_COPY[tier].blind}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

/**
 * Feed access — a SEPARATE question from the tier, and asked separately.
 *
 * The tier decides what the SYSTEM shows them: the streak, the calendar, the log.
 * This decides whether they can read and answer what YOU WROTE. Someone can be at
 * "cheer", seeing no numbers and no day-by-day at all, and still be the person you
 * talk to about it — for a lot of people that is the whole point, and folding this
 * into the tier ladder would make it unaskable.
 *
 * ⚠️ THE WARNING LINE IS LOAD-BEARING, NOT DECORATION. Granting access exposes the
 *    WHOLE feed, including everything written while the goal was private — there is
 *    no per-note toggle and no cutoff date (migration 145). This sentence, with the
 *    real number in it, is the only thing between the owner and handing over his
 *    journal. If it goes, the feature becomes a trap.
 */
function ThreadAccessChoices({
  current,
  name,
  noteCount,
}: {
  current: ThreadAccess
  name: string
  noteCount: number
}) {
  return (
    <div className="space-y-2">
      {THREAD_ACCESS.map((level) => {
        const copy = THREAD_ACCESS_COPY[level]
        // Nothing written yet means nothing to expose — the warning would be
        // ominous and untrue.
        const warn = copy.warns && noteCount > 0
          ? copy.warns.replace('{count}', `${noteCount} note${noteCount === 1 ? '' : 's'}`)
          : null
        return (
          <label
            key={level}
            className="flex items-start gap-3 rounded-lg border border-soft bg-surface-raised px-4 py-3"
          >
            <input
              type="radio"
              name="threadAccess"
              value={level}
              defaultChecked={level === current}
              className="mt-0.5 accent-accent"
              id={`${name}-${level}`}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-prose">{copy.label}</span>
              <span className="mt-0.5 block text-xs text-muted">{copy.sees}</span>
              {warn ? (
                <span className="mt-0.5 block text-xs text-accent-text">{warn}</span>
              ) : null}
            </span>
          </label>
        )
      })}
    </div>
  )
}

/**
 * The sensitive-goal gate. Rendered only on a goal flagged sensitive (cessation,
 * medication — carried from the template at create time), and the database refuses
 * anything above "cheer" without it: migration 137 enforces this with a trigger, on
 * UPDATE as well as INSERT, so inviting at cheer and quietly promoting afterwards
 * doesn't work either.
 *
 * Migration 145 widened that same trigger to cover feed access, for the reason in
 * ThreadAccessChoices: on a cessation goal the notes are the most revealing text
 * in the product, and granting access hands over all of them at once.
 *
 * Always visible rather than revealed by the radio choice — with no client
 * JavaScript there's nothing to toggle it, and it's ignored when the tier is cheer
 * and the feed stays private.
 */
function SensitiveAck() {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-strong bg-surface-raised px-4 py-3">
      <input type="checkbox" name="sensitiveAck" value="yes" className="mt-0.5 accent-accent" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-prose">
          This one&apos;s sensitive — I know what they&apos;d see.
        </span>
        <span className="mt-0.5 block text-xs text-muted">
          Needed for anything past cheering you on, and for opening your notes. Past
          that, they see every day you missed. Only you know whether that helps.
        </span>
      </span>
    </label>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</div>
}
