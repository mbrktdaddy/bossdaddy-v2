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
import { redirect } from 'next/navigation'
import MemberSearch from '@/components/members/MemberSearch'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import {
  listConnections, listIncoming, listOutgoing, listBlocked,
  type ConnectionRow, type ConnectionPerson,
} from '@/lib/connections'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { buttonVariants, type ButtonVariant } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Notice'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: LABELS.contacts.short,
  robots: { index: false, follow: false },
}

type Props = { searchParams: Promise<{ msg?: string }> }

export default async function ConnectionsPage({ searchParams }: Props) {
  const { msg } = await searchParams

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect('/login?next=/account/connections')

  const [connected, incoming, outgoing, blocked] = await Promise.all([
    listConnections(supabase, user.id),
    listIncoming(supabase, user.id),
    listOutgoing(supabase, user.id),
    listBlocked(supabase, user.id),
  ])

  return (
    <Wrap>
      <PageHeader
        size="compact"
        back={{ href: '/account', label: LABELS.account.short }}
        eyebrow={LABELS.contacts.eyebrow}
        title={LABELS.contacts.h1}
        deck={LABELS.contacts.tagline}
      />
      {/* Points at the DERIVED set rather than pretending this is it. A contact
          is who you can ask; your corner is who said yes, and that lives on
          /account because it's computed from goal_participants. */}
      <p className="mt-3 text-xs text-prose-faint leading-snug">
        Looking for who&apos;s keeping you honest?{' '}
        <Link href="/account" className="text-accent-text hover:text-prose">
          {LABELS.contacts.cornerLabel} →
        </Link>
      </p>

      {msg ? (
        <Notice variant="inline" className="mt-6">
          {msg.slice(0, 220)}
        </Notice>
      ) : null}

      {/* ── waiting on you ─────────────────────────────────────────────────── */}
      {incoming.length > 0 ? (
        <Section title="Waiting on you">
          {incoming.map((p) => (
            <PersonCard key={p.userId} person={p}>
              <Act op="accept" userId={p.userId} label="Accept" primary />
              <Act op="decline" userId={p.userId} label="Not now" />
              <Act op="block" userId={p.userId} label="Block" danger />
            </PersonCard>
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
          <EmptyState variant="panel" size="md" title="Nobody yet." body="Search above and ask someone to connect." />
        ) : connected.map((p) => (
          <PersonCard key={p.userId} person={p} sub={`Connected since ${p.since.slice(0, 10)}`}>
            {/* Message is the PRIMARY action here. Connecting is what unlocks
                messaging, so this list is the one place where the door being open
                should come with a handle — it shipped without one. */}
            <Act op="message" userId={p.userId} label="Message" primary />
            <Act op="remove" userId={p.userId} label="Disconnect" />
            <Act op="block" userId={p.userId} label="Block" danger />
          </PersonCard>
        ))}
      </Section>

      {/* ── you asked ──────────────────────────────────────────────────────── */}
      {outgoing.length > 0 ? (
        <Section title="You asked">
          {outgoing.map((p) => (
            <PersonCard key={p.userId} person={p} sub="Waiting on them">
              <Act op="withdraw" userId={p.userId} label="Pull it back" />
            </PersonCard>
          ))}
        </Section>
      ) : null}

      {/* ── blocked ────────────────────────────────────────────────────────── */}
      <Section title="Blocked">
        {blocked.length === 0 ? (
          <EmptyState variant="panel" size="md" title="Nobody. Good." />
        ) : blocked.map((p) => (
          <PersonCard key={p.userId} person={p} sub="Can&rsquo;t reach you at all">
            <Act op="unblock" userId={p.userId} label="Unblock" />
          </PersonCard>
        ))}
      </Section>
    </Wrap>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 space-y-3">
      <Eyebrow as="h2">{title}</Eyebrow>
      {children}
    </section>
  )
}

function PersonCard({
  person, sub, children,
}: { person: ConnectionRow | ConnectionPerson; sub?: string; children: React.ReactNode }) {
  return (
    <Card tone="surface" className="p-5">
      <div className="flex items-center gap-3">
        <Avatar name={person.label} size={44} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-prose truncate">{person.label}</p>
          {person.username ? (
            <p className="mt-0.5 text-xs text-prose-faint truncate">@{person.username}</p>
          ) : null}
          {sub ? <p className="mt-1 text-xs text-prose-muted">{sub}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </Card>
  )
}

/** One button, one form. Each is its own POST so nothing can submit the wrong op. */
function Act({
  op, userId, label, primary, danger,
}: { op: string; userId: string; label: string; primary?: boolean; danger?: boolean }) {
  const variant: ButtonVariant = danger ? 'danger' : primary ? 'primary' : 'outline'
  return (
    <form action="/api/connections" method="post">
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className={buttonVariants({ variant, size: 'sm' })}
      >
        {label}
      </button>
    </form>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</div>
}
