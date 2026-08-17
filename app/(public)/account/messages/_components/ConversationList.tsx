'use client'

// The conversation list — avatars, last-activity times, per-thread unread counts,
// mute state, and LIVE.
//
// ── WHY THIS IS A CLIENT COMPONENT ───────────────────────────────────────────
// Two reasons, and both were defects before it was one:
//
//   1. THE PAGE WAS THE STALEST SURFACE ON THE SCREEN. The header bell subscribes
//      to Realtime, so sitting on /account/messages while a message arrived
//      updated the badge in the chrome and left the list untouched. Having the
//      summary be fresher than the full surface reads as broken — the inbox should
//      be the MOST live thing, not the least.
//
//   2. TIMES CAN'T BE SERVER-RENDERED. Every format below is locale- and
//      timezone-dependent, so SSR would print the server's timezone and hydration
//      would find different text. Formatting after mount is the fix, and that
//      needs a client component anyway.
//
// The subscription mirrors the bell's: `conversation_participants` filtered to me.
// A new message bumps every participant's `last_activity_at` (migration 083's
// trigger), so that one table is enough to catch sends, reads, mutes and deletes.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { activityTime } from '@/lib/activity-time'
import type { ConversationSummary } from '@/lib/messaging-queries'

function MutedIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V5a2 2 0 1 0-4 0v.3C7.7 6.2 6 8.4 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9M3 3l18 18" />
    </svg>
  )
}

function Avatar({ conv }: { conv: ConversationSummary }) {
  const name = conv.peer?.displayName || conv.peer?.username || 'Member'
  if (conv.peer?.avatarUrl) {
    return (
      <Image
        src={conv.peer.avatarUrl}
        alt=""
        width={44}
        height={44}
        className="w-11 h-11 rounded-full object-cover shrink-0 bg-surface-raised"
        unoptimized
      />
    )
  }
  return (
    <span
      className="w-11 h-11 rounded-full bg-surface-raised text-prose-muted text-base font-bold flex items-center justify-center shrink-0 uppercase"
      aria-hidden
    >
      {name.charAt(0)}
    </span>
  )
}

export default function ConversationList({
  initial, userId,
}: { initial: ConversationSummary[]; userId: string }) {
  const [convs, setConvs] = useState<ConversationSummary[]>(initial)
  // Times stay blank until mount, then fill in. See lib/activity-time.
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  const reload = useCallback(async () => {
    const res = await fetch('/api/messages/conversations', { cache: 'no-store' })
    if (!res.ok) return
    const json = await res.json()
    setConvs(json.conversations ?? [])
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`conversation-list:${userId}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` },
        () => reload(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, reload])

  // Reconcile on return-to-page. Mobile browsers and the standalone PWA suspend
  // the websocket when backgrounded, so live updates never arrive and the list
  // silently goes stale — the same fix ActivityMenu carries, including bfcache
  // restores via pageshow.
  useEffect(() => {
    function refresh() { if (document.visibilityState !== 'hidden') reload() }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [reload])

  if (convs.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-prose-faint">
        No conversations yet — use <span className="font-semibold text-prose">New message</span> above to start one.
      </p>
    )
  }

  return (
    <>
      {convs.map((c) => {
        const name = c.peer?.displayName || c.peer?.username || 'Member'
        return (
          <Link
            key={c.id}
            href={`/account/messages/${c.id}`}
            className={`flex items-center gap-3 px-4 py-3.5 hover:bg-surface-raised transition-colors ${
              // A muted thread never gets the highlight, even when unread. It still
              // shows its count — you can see it — it just stops shouting.
              c.unread && !c.muted ? 'bg-accent-tint/40' : ''
            }`}
          >
            <Avatar conv={c} />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className={`text-sm truncate ${c.unread ? 'font-bold text-prose' : 'font-semibold text-prose'}`}>
                  {name}
                </p>
                {c.muted && <span className="text-prose-faint shrink-0"><MutedIcon /></span>}
                {/* Time is right-aligned and never shrinks — the name truncates
                    instead. A list you can't scan by time is a list you re-read. */}
                {mounted && c.lastMessage && (
                  <span className="ml-auto shrink-0 text-[11px] text-prose-faint tabular-nums">
                    {activityTime(c.lastMessage.createdAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {c.lastMessage && (
                  <p className={`text-xs truncate ${c.unread && !c.muted ? 'text-prose' : 'text-prose-muted'}`}>
                    {c.lastMessage.fromMe ? 'You: ' : ''}{c.lastMessage.body}
                  </p>
                )}
                {/* THE COUNT, not just a dot. One unread thread carrying fourteen
                    messages and one carrying "ok" used to look identical. Capped at
                    9+ so the pill can't widen the row. */}
                {c.unreadCount > 0 && (
                  <span
                    className={`ml-auto shrink-0 inline-flex min-w-5 h-5 items-center justify-center rounded-full px-1.5 text-[11px] font-black tabular-nums ${
                      c.muted ? 'bg-surface-hover text-prose-muted' : 'bg-accent text-white'
                    }`}
                    aria-label={`${c.unreadCount} unread`}
                  >
                    {c.unreadCount > 9 ? '9+' : c.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </Link>
        )
      })}
    </>
  )
}
