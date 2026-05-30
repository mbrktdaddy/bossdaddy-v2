'use client'

// Header messages menu — envelope icon + unread badge + recent conversations
// dropdown. Realtime: subscribes to conversation_participants for the current
// user; the message-insert trigger bumps last_activity_at on every member's
// row, so any new message re-fires this and we refetch.

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface ConversationSummary {
  id:          string
  peer:        { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null
  unread:      boolean
}

export default function MessagesMenu({ userId }: { userId: string }) {
  const [open, setOpen]   = useState(false)
  const [convs, setConvs] = useState<ConversationSummary[]>([])
  const [unread, setUnread] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/messages/conversations')
    if (!res.ok) return
    const json = await res.json()
    setConvs(json.conversations ?? [])
    setUnread(json.unread ?? 0)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  // Realtime — re-pull on any change to my conversation rows. Synchronous
  // (uid from props) + unique topic per mount; avoids the async-getUser race
  // that re-attached handlers after subscribe().
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`messages-menu:${userId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, load])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function peerName(c: ConversationSummary): string {
    return c.peer?.displayName || c.peer?.username || 'Member'
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Messages (${unread} unread)` : 'Messages'}
        className="relative p-2 text-prose-muted hover:text-prose rounded-lg hover:bg-surface-raised transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-accent rounded-full leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-surface border border-soft rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-soft">
            <span className="text-sm font-bold text-prose">Messages</span>
            <Link href="/account/messages" className="text-xs text-accent hover:text-accent-hover font-semibold">All messages</Link>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {convs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-prose-faint">No conversations yet.</p>
            ) : (
              convs.slice(0, 8).map((c) => (
                <Link
                  key={c.id}
                  href={`/account/messages/${c.id}`}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-soft/60 last:border-0 hover:bg-surface-raised transition-colors ${c.unread ? 'bg-accent-tint/40' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-prose truncate">{peerName(c)}</p>
                    {c.lastMessage && (
                      <p className="text-xs text-prose-muted truncate">
                        {c.lastMessage.fromMe ? 'You: ' : ''}{c.lastMessage.body}
                      </p>
                    )}
                  </div>
                  {c.unread && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
