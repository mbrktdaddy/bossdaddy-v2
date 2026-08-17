// Contacts — who you're connected to, who's asking, who you've asked, who you've
// shut out.
//
// NOT "your corner", which this was called first and which meant something else.
// A contact is who you CAN reach; your corner is who accepted a share on one of
// your goals, which is derived from goal_participants and lives on /account. See
// LABELS.contacts.
//
// This page is also the app's FIRST blocked-list. Before connections, blocking
// lived in the ⋮ menu inside a DM thread, so you could only block someone you had
// already talked to and there was nowhere to see or undo it. That was fine while
// DMs were open to everyone; it stops being fine the moment a stranger can put a
// request in front of you.
//
// Every ACTION here is a plain form POSTing to /api/connections — no client JS, a
// real navigation, and nothing to hydrate. The one client component is the member
// search box, which needs search-as-you-type; its own buttons are still plain
// forms, so the accept/connect/block paths stay JS-free even inside it.

import Link from 'next/link'
import MemberSearch from '@/components/members/MemberSearch'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { LoginLink } from '@/components/LoginLink'
import {
  listConnections, listIncoming, listOutgoing, listBlocked,
  type ConnectionRow, type ConnectionPerson,
} from '@/lib/connections'

export const metadata: Metadata = {
  title: LABELS.contacts.short,
  robots: { index: false, follow: false },
}

type Props = { searchParams: Promise<{ msg?: string }> }

export default async function ConnectionsPage({ searchParams }: Props) {
  const { msg } = await searchParams

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) {
    return (
      <Wrap>
        <h1 className="text-2xl font-black text-prose">Sign in to see your contacts.</h1>
        <LoginLink className="mt-6 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Sign in →
        </LoginLink>
      </Wrap>
    )
  }

  const [connected, incoming, outgoing, blocked] = await Promise.all([
    listConnections(supabase, user.id),
    listIncoming(supabase, user.id),
    listOutgoing(supabase, user.id),
    listBlocked(supabase, user.id),
  ])

  return (
    <Wrap>
      <header className="space-y-2">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {LABELS.contacts.eyebrow}
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-prose leading-tight tracking-tight">
          {LABELS.contacts.h1}
        </h1>
        <p className="text-sm text-prose-muted leading-snug">{LABELS.contacts.tagline}</p>
        {/* Points at the DERIVED set rather than pretending this is it. A contact
            is who you can ask; your corner is who said yes, and that lives on
            /account because it's computed from goal_participants. */}
        <p className="text-xs text-prose-faint leading-snug">
          Looking for who&apos;s keeping you honest?{' '}
          <Link href="/account" className="text-accent-text hover:text-prose">
            {LABELS.contacts.cornerLabel} →
          </Link>
        </p>
      </header>

      {msg ? (
        <p className="mt-6 rounded-lg border border-strong bg-surface-raised px-4 py-3 text-sm text-accent-text">
          {msg.slice(0, 220)}
        </p>
      ) : null}

      {/* ── waiting on you ─────────────────────────────────────────────────── */}
      {incoming.length > 0 ? (
        <Section title="Waiting on you">
          {incoming.map((p) => (
            <Card key={p.userId} person={p}>
              <Act op="accept" userId={p.userId} label="Accept" primary />
              <Act op="decline" userId={p.userId} label="Not now" />
              <Act op="block" userId={p.userId} label="Block" />
            </Card>
          ))}
        </Section>
      ) : null}

      {/* ── find someone ───────────────────────────────────────────────────── */}
      {/* THE PAGE COULDN'T ADD A CONTACT UNTIL NOW, which is the whole reason this
          section exists. Search shipped inside the messages route, so the page
          titled "Who you can reach" had no way to reach anyone new and its empty
          state sent you to your messages to find someone — a page that is also
          empty for exactly the member who needed the advice. A closed loop.

          IT SITS BELOW "WAITING ON YOU" ON PURPOSE, and the conditional ordering
          does two jobs with one layout: a man with requests pending sees those
          first because answering someone who asked outranks going looking, while a
          new member — for whom that section is hidden — gets the search box as the
          first thing under the header, which is where every other product puts it. */}
      <Section title="Find someone">
        <MemberSearch />
      </Section>

      {/* ── connected ──────────────────────────────────────────────────────── */}
      {/* NOT "in your corner" — this is everyone you can reach. The corner is the
          smaller, derived set on /account. */}
      <Section title="Connected">
        {connected.length === 0 ? (
          <Empty>Nobody yet. Search above and ask someone to connect.</Empty>
        ) : connected.map((p) => (
          <Card key={p.userId} person={p} sub={`Connected since ${p.since.slice(0, 10)}`}>
            {/* Message is the PRIMARY action here. Connecting is what unlocks
                messaging, so this list is the one place where the door being open
                should come with a handle — it shipped without one. */}
            <Act op="message" userId={p.userId} label="Message" primary />
            <Act op="remove" userId={p.userId} label="Disconnect" />
            <Act op="block" userId={p.userId} label="Block" />
          </Card>
        ))}
      </Section>

      {/* ── you asked ──────────────────────────────────────────────────────── */}
      {outgoing.length > 0 ? (
        <Section title="You asked">
          {outgoing.map((p) => (
            <Card key={p.userId} person={p} sub="Waiting on them">
              <Act op="withdraw" userId={p.userId} label="Pull it back" />
            </Card>
          ))}
        </Section>
      ) : null}

      {/* ── blocked ────────────────────────────────────────────────────────── */}
      <Section title="Blocked">
        {blocked.length === 0 ? (
          <Empty>Nobody. Good.</Empty>
        ) : blocked.map((p) => (
          <Card key={p.userId} person={p} sub="Can&rsquo;t reach you at all">
            <Act op="unblock" userId={p.userId} label="Unblock" />
          </Card>
        ))}
      </Section>
    </Wrap>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 space-y-3">
      <h2 className="text-sm font-bold text-prose uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-prose-faint">{children}</p>
}

function Card({
  person, sub, children,
}: { person: ConnectionRow | ConnectionPerson; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-soft bg-surface p-5">
      <p className="text-sm font-semibold text-prose truncate">{person.label}</p>
      {person.username ? (
        <p className="mt-0.5 text-xs text-prose-faint truncate">@{person.username}</p>
      ) : null}
      {sub ? <p className="mt-1 text-xs text-prose-muted">{sub}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

/** One button, one form. Each is its own POST so nothing can submit the wrong op. */
function Act({
  op, userId, label, primary,
}: { op: string; userId: string; label: string; primary?: boolean }) {
  return (
    <form action="/api/connections" method="post">
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className={primary
          ? 'min-h-11 rounded-lg bg-accent px-5 py-3 text-xs font-bold text-white hover:bg-accent-hover transition-colors'
          : 'min-h-11 rounded-lg border border-soft bg-surface px-5 py-3 text-xs font-semibold text-prose-muted hover:bg-surface-hover hover:text-prose transition-colors'}
      >
        {label}
      </button>
    </form>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</div>
}
