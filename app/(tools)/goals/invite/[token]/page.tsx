// The invitee's side of an invite link.
//
// The whole page exists to make consent informed. It states exactly what accepting
// would let you see, in the same words the owner read when he picked the tier —
// TIER_COPY is shared by both screens so they cannot drift into promising different
// things.
//
// It shows the goal's TITLE and nothing else. Not the metric, not the numbers, not
// the identity statement: nobody sees inside a goal before they've accepted, or the
// tiers would be theatre.
//
// The token is the authorization, so the preview is read with the admin client —
// the visitor isn't a participant yet, and RLS would correctly show them nothing.

import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LABELS } from '@/lib/labels'
import { ogImageMeta } from '@/lib/og'
import { LoginLink } from '@/components/LoginLink'
import { previewInvitation, TIER_COPY, THREAD_ACCESS_COPY } from '@/lib/goals/participants'

// ⚠️ THE GOAL TITLE MUST NEVER APPEAR IN THIS METADATA. STATIC ONLY — do not turn
// this into generateMetadata().
//
// This link's entire job is to be pasted into a text message, and every messaging
// platform fetches it server-side to build a preview. A friendly-looking
// improvement like `title: \`${goal.title} — an invite\`` would render "Quit
// smoking" as a rich card in whatever group chat it lands in, to everyone in the
// thread, before the invitee has agreed to anything. The page body may name the
// goal — that's shown to someone who opened the link deliberately. The unfurl is
// shown to bystanders.
//
// Branded rather than bare on purpose: a link with no preview reads as phishing in
// a text thread, which works against the very thing the invite is trying to do.
// Signal group invites, Calendly and Doodle all take the same line — name the
// brand and the category, never the payload.
//
// The images are set EXPLICITLY even though the root layout has defaults, because
// Next.js REPLACES `openGraph` wholesale rather than merging it: defining
// og:title here without og:image would silently drop the card image and leave a
// text-only unfurl. Same trap the root layout documents for twitter.images.
const socialCard = ogImageMeta({
  title: 'Someone wants you in their corner',
  type: 'review',
  alt: 'Boss Daddy Life — an invitation.',
})

export const metadata: Metadata = {
  title: `An invite — ${LABELS.goals.short}`,
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Someone wants you in their corner',
    description: 'A Boss Daddy member asked you to help him stick to something.',
    siteName: 'Boss Daddy Life',
    type: 'website',
    locale: 'en_US',
    images: [socialCard],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@bossdaddylife',
    title: 'Someone wants you in their corner',
    description: 'A Boss Daddy member asked you to help him stick to something.',
    images: [socialCard],
  },
}

type Props = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ msg?: string }>
}

export default async function GoalInvitePage({ params, searchParams }: Props) {
  const { token } = await params
  const { msg } = await searchParams

  // WHO'S LOOKING IS RESOLVED FIRST, because the preview depends on it: an invite
  // addressed to a specific member won't show its goal to anyone else, and won't
  // show it at all to a visitor we can't identify.
  //
  // A bare link invite is unaffected — signed-out visitors still see the whole
  // offer before being asked for anything, because "sign in to find out what this
  // is" is how an invite gets abandoned. The token survives the round trip in
  // `next`.
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  const preview = await previewInvitation(createAdminClient(), token, user?.id ?? null)

  if (!preview.ok) {
    // An addressed invite viewed signed-out isn't a dead end — it's one step from
    // working, so offer the step rather than a shrug.
    if (preview.needsSignIn) {
      return (
        <Wrap>
          <h1 className="text-2xl font-black text-prose">You&apos;ve been invited.</h1>
          <p className="mt-3 text-sm text-prose-muted">{preview.reason}</p>
          <LoginLink className="mt-6 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Sign in to see it →
          </LoginLink>
        </Wrap>
      )
    }
    return (
      <Wrap>
        <h1 className="text-2xl font-black text-prose">That invite won&apos;t open.</h1>
        <p className="mt-3 text-sm text-prose-muted">{preview.reason}</p>
        <Link
          href="/goals"
          className="mt-6 inline-flex min-h-11 items-center text-xs font-semibold text-accent-text hover:text-prose"
        >
          Your own goals →
        </Link>
      </Wrap>
    )
  }

  const { goalTitle, inviterName, tier, threadAccess, expiresAt } = preview.preview

  return (
    <Wrap>
      <header className="space-y-3">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          An invite
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-prose leading-tight tracking-tight">
          {inviterName} wants you in his corner.
        </h1>
        <p className="text-base text-prose-muted leading-snug">
          He&apos;s working on <span className="text-prose font-semibold">{goalTitle}</span>{' '}
          and asked if you&apos;d keep an eye on it.
        </p>
      </header>

      {msg ? (
        <p className="mt-6 rounded-lg border border-strong bg-surface-raised px-4 py-3 text-sm text-accent-text">
          {msg.slice(0, 220)}
        </p>
      ) : null}

      {/* Exactly what you'd get, and exactly what you wouldn't. */}
      <div className="mt-8 rounded-xl border border-strong bg-surface-raised p-5">
        <p className="text-sm font-bold text-prose">{TIER_COPY[tier].label}</p>
        <p className="mt-2 text-sm text-prose-muted">{TIER_COPY[tier].sees}</p>
        <p className="mt-1 text-sm text-prose-faint">{TIER_COPY[tier].blind}</p>
      </div>

      {/* The feed offer, stated on its own. It is a different kind of access from
          the tier — what he chose to SAY, not what the app recorded — and an
          invitee who is about to be handed someone's private journal should be
          told that in its own box rather than in a footnote. */}
      {threadAccess !== 'none' ? (
        <div className="mt-4 rounded-xl border border-soft bg-surface p-5">
          <p className="text-sm font-bold text-prose">{THREAD_ACCESS_COPY[threadAccess].label}</p>
          <p className="mt-2 text-sm text-prose-muted">{THREAD_ACCESS_COPY[threadAccess].sees}</p>
        </div>
      ) : null}

      <ul className="mt-6 space-y-2 text-xs text-prose-faint">
        {/*
          ⚠️ THIS LINE IS CONDITIONAL BECAUSE IT IS A PROMISE. Unconditionally it
             used to read "you'll never be notified about this" — true when the
             only thing to know was whether he'd logged a dose, and the sweep is
             still owner-only so that half stands. But a notes feed pings you when
             someone writes in it (migration 145), and telling an invitee otherwise
             on the screen where they consent would be a lie at the worst moment.
        */}
        {threadAccess === 'none' ? (
          <li>· You&apos;ll never be notified about this. Nothing gets pushed or emailed to you — you look when you want to.</li>
        ) : (
          <li>· You&apos;ll be pinged when someone writes in the notes — and only then. Nothing tells you about a day he missed.</li>
        )}
        <li>· You can walk away whenever you like, and you don&apos;t need his say-so.</li>
        <li>· He can stop sharing whenever he likes too.</li>
        <li>· Expires {expiresAt.slice(0, 10)}.</li>
      </ul>

      {!user ? (
        <div className="mt-8 rounded-xl border border-soft bg-surface p-5">
          <p className="text-sm text-prose-muted">
            Sign in and this is yours to accept — it&apos;s tied to your account, not
            to this link.
          </p>
          {/* LoginLink returns to the CURRENT page after auth (useLoginHref), so
              the token survives the round trip without being threaded anywhere. */}
          <LoginLink className="mt-4 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Sign in to accept →
          </LoginLink>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <form action="/api/goals/invite" method="post" className="flex-1">
            <input type="hidden" name="op" value="accept" />
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="min-h-11 w-full rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover transition-colors"
            >
              I&apos;m in
            </button>
          </form>
          {/* Declining is a first-class action, recorded as declined rather than
              left to expire — turning it down is an answer, not a silence. */}
          <form action="/api/goals/invite" method="post">
            <input type="hidden" name="op" value="decline" />
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="min-h-11 w-full rounded-lg border border-soft bg-surface px-6 py-3 text-sm font-semibold text-prose-muted hover:bg-surface-hover transition-colors sm:w-auto"
            >
              No thanks
            </button>
          </form>
        </div>
      )}
    </Wrap>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14">{children}</div>
}
