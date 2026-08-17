'use client'

// DM thread: message list + composer, Realtime append, mark-read, reactions,
// replies, and a mute / block / report / delete menu. Every gate is server-side
// (RLS + the actions in lib/messaging.ts); this UI reflects and toggles state.

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { REACTION_KINDS, REACTIONS, reactionEmoji, type ReactionKind } from '@/lib/messaging-reactions'
import {
  sendMessage, markConversationRead, blockUser, unblockUser, reportContent,
  deleteConversation, setConversationMuted, toggleReaction,
} from '@/lib/messaging'

interface Message {
  id: string
  sender_id: string
  body: string
  created_at: string
  attachment_path: string | null
  attachment_width: number | null
  attachment_height: number | null
  reply_to_id: string | null
}
/** Just enough of a message to render a quote — parents are often older than the window. */
interface ParentMessage { id: string; sender_id: string; body: string; attachment_path: string | null }
interface ReactionRow { message_id: string; user_id: string; kind: string }
interface Peer { id: string; username: string; displayName: string | null; avatarUrl: string | null }

const REPORT_REASONS = ['Spam', 'Harassment', 'Inappropriate content', 'Other']

function draftKey(conversationId: string) { return `bd_dm_draft:${conversationId}` }

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  })
}

/** What a quoted message reads as in one line. */
function snippetOf(m: ParentMessage | Message): string {
  return m.body.trim() || (m.attachment_path ? 'Photo' : '')
}

function PeerAvatar({ peer, size = 28 }: { peer: Peer | null; size?: number }) {
  const name = peer?.displayName || peer?.username || 'Member'
  if (peer?.avatarUrl) {
    return (
      <Image
        src={peer.avatarUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0 bg-surface-raised"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="rounded-full bg-surface-raised text-prose-muted font-bold flex items-center justify-center shrink-0 uppercase"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {name.charAt(0)}
    </span>
  )
}

/** Bell-with-a-slash. An SVG, not 🔇 — this one is chrome (brand-guide §7.1). */
function MutedIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V5a2 2 0 1 0-4 0v.3C7.7 6.2 6 8.4 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9M3 3l18 18" />
    </svg>
  )
}

export default function Thread({
  conversationId, meId, peer, initialMessages, initialReplyParents, initialReactions,
  initiallyBlocked, initiallyMuted, initialPeerLastReadAt,
}: {
  conversationId: string
  meId: string
  peer: Peer | null
  initialMessages: Message[]
  initialReplyParents: ParentMessage[]
  initialReactions: ReactionRow[]
  initiallyBlocked: boolean
  initiallyMuted: boolean
  initialPeerLastReadAt: string | null
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [replyParents] = useState<ParentMessage[]>(initialReplyParents)
  const [reactions, setReactions] = useState<ReactionRow[]>(initialReactions)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(initiallyBlocked)
  const [muted, setMuted] = useState(initiallyMuted)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reported, setReported] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(initialPeerLastReadAt)
  // Which message has its action row open (react / reply). One at a time.
  const [actionsFor, setActionsFor] = useState<string | null>(null)
  // The message being replied to, if any.
  const [replyToId, setReplyToId] = useState<string | null>(null)
  // Pending image attachment (one per message) + its object-URL preview. The
  // draft textarea doubles as an optional caption while one is staged.
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null)
  // Message id whose image is open in the lightbox (null = closed).
  const [lightboxId, setLightboxId] = useState<string | null>(null)
  // Gate locale-formatted timestamps behind mount so SSR (server timezone) and
  // the client's first paint match — avoids a hydration mismatch on the times.
  const [mounted, setMounted] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Whether the list is pinned to the bottom. We only auto-scroll (on new
  // messages or late-loading images) while the user is already at the bottom —
  // scrolling up to read history must never yank them back down.
  const stickToBottom = useRef(true)

  const peerName = peer?.displayName || peer?.username || 'Member'

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  // Restore a saved draft for this conversation so a reload or accidental
  // navigation doesn't lose an in-progress message. Persisting happens in the
  // change handler (below), not an effect — avoids an ordering race where the
  // persist effect's initial empty run wipes the just-restored value.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey(conversationId))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setDraft(saved)
    } catch { /* ignore */ }
  }, [conversationId])

  function updateDraft(value: string) {
    setDraft(value)
    try {
      if (value) localStorage.setItem(draftKey(conversationId), value)
      else localStorage.removeItem(draftKey(conversationId))
    } catch { /* ignore */ }
  }

  function clearDraft() {
    setDraft('')
    try { localStorage.removeItem(draftKey(conversationId)) } catch { /* ignore */ }
  }

  // Scroll only the message list's own scroll container — NOT scrollIntoView,
  // which bubbles to the window and yanks the whole page (hiding the top of
  // the thread and the composer below the fold).
  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  // Jump to a quoted message. Rect deltas rather than offsetTop, which would
  // depend on which ancestor happens to be positioned; and the container's own
  // scrollTop rather than scrollIntoView, for the reason above.
  const scrollToMessage = useCallback((id: string) => {
    const c = listRef.current
    const el = c?.querySelector<HTMLElement>(`[data-mid="${id}"]`)
    if (!c || !el) return
    c.scrollTop += el.getBoundingClientRect().top - c.getBoundingClientRect().top - 48
  }, [])

  // Track whether we're parked at the bottom (within a small threshold).
  const onListScroll = useCallback(() => {
    const el = listRef.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }, [])

  /**
   * MEASURE THE AVAILABLE HEIGHT — don't assume it.
   *
   * This shell used to be `h-[calc(100dvh-4rem)]`, i.e. "the viewport minus a 4rem
   * header". On mobile the header is 4rem of masthead PLUS a search row, so the
   * shell was ~3.5rem taller than the space it had and THE WHOLE COMPOSER — attach,
   * input, Send — sat below the fold. Hiding that row on immersive routes fixes the
   * arithmetic, but a magic number that has to agree with a component two files away
   * will drift again the next time the header gains a row.
   *
   * So: take this element's own distance from the top of the visible area and fill
   * what's left. `visualViewport` rather than innerHeight because it is the only
   * thing that shrinks when the SOFTWARE KEYBOARD opens — with the default
   * `resizes-visual` behaviour, dvh units do not, so on Android the composer ends up
   * underneath the keyboard the moment you tap it. Re-pins to the bottom after a
   * resize so the newest message stays visible as the keyboard comes up.
   *
   * The Tailwind classes stay as the pre-JS fallback; this only ever refines them.
   */
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function apply() {
      const el = shellRef.current
      if (!el || !vv) return
      // offsetTop is how far the visible area itself has been pushed down (pinch
      // zoom / keyboard scroll); without it the maths is off by that amount.
      const top = el.getBoundingClientRect().top - vv.offsetTop
      // A floor so a freak measurement can't collapse the thread to nothing.
      el.style.height = `${Math.max(260, vv.height - top)}px`
      if (stickToBottom.current) scrollToBottom()
    }

    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    window.addEventListener('orientationchange', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      window.removeEventListener('orientationchange', apply)
    }
  }, [scrollToBottom])

  /**
   * Auto-grow the composer.
   *
   * `rows={1}` with `max-h-32` and no JS is a one-line box FOREVER: the cap was
   * there but nothing ever grew into it, so a long message scrolled inside a single
   * visible line and you couldn't see what you'd written. Every messenger grows the
   * field from one line to a few and only then scrolls internally.
   *
   * Height is reset to 'auto' before reading scrollHeight — without that,
   * scrollHeight is measured against the height already set and the box can only
   * ever ratchet upward, never shrink back when text is deleted. The CSS max-height
   * still clamps it, and the textarea's own overflow takes over past that.
   */
  const autoGrow = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  // One place, so it covers typing, a restored draft, and clearing after send —
  // rather than three call sites where the third gets forgotten.
  useEffect(() => { autoGrow() }, [draft, autoGrow])

  // Mark read on mount + whenever messages change.
  useEffect(() => { markConversationRead(conversationId) }, [conversationId, messages.length])
  // Auto-scroll on new messages only while pinned to the bottom.
  useEffect(() => { if (stickToBottom.current) scrollToBottom() }, [messages.length, scrollToBottom])

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!lightboxId) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setLightboxId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxId])

  // Revoke the staged preview URL if the thread unmounts mid-compose.
  useEffect(() => () => { if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl) }, [pendingImage])

  // Realtime: new messages, the peer's read state (for "Seen"), and reactions.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`thread:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Message
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m])
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { user_id: string; last_read_at: string }
          if (row.user_id !== meId) setPeerLastReadAt(row.last_read_at)
        },
      )
      // NO `filter` HERE, because postgres_changes filters one column and the
      // interesting key is "message_id is any of the ones on screen". RLS still
      // scopes the stream to conversations I'm in (migration 155's
      // is_message_participant), and rows for other threads are dropped below by
      // the id check. A DELETE payload carries only the primary key columns —
      // (message_id, user_id) — which is exactly what removing one needs.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const row = (payload.new ?? payload.old) as ReactionRow | null
          if (!row?.message_id) return
          setReactions((prev) => {
            const without = prev.filter((r) => !(r.message_id === row.message_id && r.user_id === row.user_id))
            if (payload.eventType === 'DELETE') return without
            const next = payload.new as ReactionRow
            return [...without, { message_id: next.message_id, user_id: next.user_id, kind: next.kind }]
          })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId, meId])

  // Stage an image for sending. Compress client-side first so a 12MP phone
  // shot doesn't upload at full size; the server re-encodes again (and strips
  // EXIF/GPS) regardless. Falls back to the raw file if compression fails.
  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0]
    e.target.value = ''
    if (!raw) return
    setError(null)
    const file = await compressImage(raw).catch(() => raw)
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl)
      return { file, previewUrl: URL.createObjectURL(file) }
    })
  }

  function removePendingImage() {
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }

  async function send() {
    const text = draft.trim()
    if (sending) return
    // Sending always re-pins to the bottom so my own message scrolls into view.
    stickToBottom.current = true

    if (pendingImage) {
      setSending(true); setError(null)
      try {
        const fd = new FormData()
        fd.append('conversationId', conversationId)
        fd.append('file', pendingImage.file)
        if (text) fd.append('caption', text)
        if (replyToId) fd.append('replyToId', replyToId)
        const res = await fetch('/api/dm/upload', { method: 'POST', body: fd })
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) { setError(json.error || 'Could not send image'); setSending(false); return }
        removePendingImage()
        clearDraft()
        setReplyToId(null)
      } catch {
        setError('Could not send image — please try again')
      }
      setSending(false)
      return
    }

    if (!text) return
    setSending(true); setError(null)
    const res = await sendMessage(conversationId, text, replyToId)
    setSending(false)
    if (!res.ok) { setError(res.error); return }
    clearDraft()
    setReplyToId(null)
    // Realtime will append; nothing else to do.
  }

  /**
   * React, optimistically. The row is replaced locally before the round trip so
   * the tap feels instant, then reconciled from the server's answer — which is
   * authoritative because it knows whether this was a toggle-off, a replacement,
   * or a refusal (blocked / disconnected).
   */
  async function react(messageId: string, kind: ReactionKind) {
    const mine = reactions.find((r) => r.message_id === messageId && r.user_id === meId)
    const removing = mine?.kind === kind
    setReactions((prev) => {
      const without = prev.filter((r) => !(r.message_id === messageId && r.user_id === meId))
      return removing ? without : [...without, { message_id: messageId, user_id: meId, kind }]
    })

    const res = await toggleReaction(messageId, kind)
    if (!res.ok) {
      setError(res.error)
      // Put back exactly what was there before.
      setReactions((prev) => {
        const without = prev.filter((r) => !(r.message_id === messageId && r.user_id === meId))
        return mine ? [...without, mine] : without
      })
    }
  }

  async function toggleBlock() {
    setMenuOpen(false)
    if (!peer) return
    if (blocked) { await unblockUser(peer.id); setBlocked(false) }
    else { await blockUser(peer.id); setBlocked(true) }
  }

  async function toggleMute() {
    setMenuOpen(false)
    const next = !muted
    setMuted(next)
    const res = await setConversationMuted(conversationId, next)
    if (!res.ok) { setMuted(!next); setError(res.error) }
  }

  async function submitReport(reason: string) {
    if (!peer) return
    await reportContent({ reportedUserId: peer.id, conversationId, reason })
    setReportOpen(false); setReported(true)
  }

  // Two-tap confirm (no native dialog). Delete-for-me: removes the thread from
  // my list; the other person keeps theirs. Hard-nav back to the list.
  async function removeConversation() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setMenuOpen(false)
    const res = await deleteConversation(conversationId)
    if (res.ok) window.location.assign('/account/messages')
  }

  /** The quoted message, from the window first and the fetched parents second. */
  function parentOf(id: string): ParentMessage | null {
    return messages.find((m) => m.id === id) ?? replyParents.find((p) => p.id === id) ?? null
  }

  /** Reactions on one message, grouped by kind, mine flagged. */
  function groupsFor(messageId: string) {
    const rows = reactions.filter((r) => r.message_id === messageId)
    const byKind = new Map<string, string[]>()
    for (const r of rows) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.user_id])
    return Array.from(byKind, ([kind, users]) => ({ kind, users, mine: users.includes(meId) }))
      .filter((g) => reactionEmoji(g.kind) !== null)
  }

  // Index of my most recent message — the only one that can show "Seen".
  let lastMineIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_id === meId) { lastMineIdx = i; break }
  }
  const peerHasSeenLast =
    lastMineIdx >= 0 &&
    !!peerLastReadAt &&
    new Date(peerLastReadAt).getTime() >= new Date(messages[lastMineIdx].created_at).getTime()

  const replyParent = replyToId ? parentOf(replyToId) : null

  // Mobile hides the bottom nav here (immersive route) → subtract only the 4rem
  // header. Desktop keeps the original 8rem (no nav, footer below).
  return (
    <div
      ref={shellRef}
      className="max-w-2xl mx-auto px-4 pt-4 sm:pt-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-6 flex flex-col h-[calc(100dvh-4rem)] md:h-[calc(100dvh-8rem)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-soft">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/account/messages" className="text-prose-faint hover:text-prose text-sm">←</Link>
          <PeerAvatar peer={peer} size={28} />
          {/* PLAIN TEXT, NOT A LINK TO /author/<username>. It was one, and for most
              peers that link went to a page about a "Contributor" with nothing
              published — /author now 404s for anyone who isn't an author, so
              linking a name here would send a man to a dead end most of the time.
              There is no member profile to point at yet; when there is, this is
              the first place it should be wired in. Peer identity in this header
              is already avatar + name, which is what a thread needs. */}
          <span className="text-sm font-bold text-prose truncate">{peerName}</span>
          {/* Muted state is visible WITHOUT opening the menu — otherwise the only
              way to find out why a thread stopped pinging is to go looking. */}
          {muted && (
            <span className="text-prose-faint shrink-0" title="Notifications muted">
              <MutedIcon />
              <span className="sr-only">Notifications muted</span>
            </span>
          )}
        </div>
        {peer && (
          <div className="relative">
            <button type="button" onClick={() => { setMenuOpen((o) => !o); setConfirmDelete(false) }} aria-label="Conversation options"
              className="p-1.5 text-prose-faint hover:text-prose rounded-lg hover:bg-surface-raised">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-surface border border-soft rounded-xl shadow-xl z-20 overflow-hidden">
                {/* Mute sits ABOVE block, and reads as the softer option it is:
                    block severs the connection (and cascades away goal
                    participation); this just stops the pinging. */}
                <button type="button" onClick={toggleMute} className="block w-full text-left px-4 py-2.5 text-sm text-prose hover:bg-surface-raised">
                  {muted ? 'Unmute notifications' : 'Mute notifications'}
                </button>
                <button type="button" onClick={toggleBlock} className="block w-full text-left px-4 py-2.5 text-sm text-prose hover:bg-surface-raised border-t border-soft">
                  {blocked ? 'Unblock' : 'Block'} {peerName}
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); setReportOpen(true) }} className="block w-full text-left px-4 py-2.5 text-sm text-danger-ink hover:bg-danger-bg">
                  Report
                </button>
                <button type="button" onClick={removeConversation} className="block w-full text-left px-4 py-2.5 text-sm text-danger-ink hover:bg-danger-bg border-t border-soft">
                  {confirmDelete ? 'Tap again to delete' : 'Delete conversation'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages.
          ── BOTTOM-ALIGNED, which is the half of the convention this was missing.
          The composer is docked at the bottom of the pane permanently (that part was
          right, and it's what every messenger does — a composer that floats up under
          the last message moves on every send and you have to hunt for it). But the
          messages were TOP-aligned, so a two-message thread left a screen of dead
          space between the last bubble and the input, which reads as broken layout.
          Bottom-aligning puts that space ABOVE the thread, where it reads as "this
          conversation is new" — the same as WhatsApp, Telegram, iMessage, Slack.

          `mt-auto` on an inner wrapper rather than `justify-end` on the scroll
          container itself: justify-end on an overflowing flex scroller has a long
          history of making the top of the content unreachable, while mt-auto simply
          has no effect once the content is taller than the pane. */}
      <div ref={listRef} onScroll={onListScroll} className="flex-1 overflow-y-auto flex flex-col">
        {messages.length === 0 ? (
          // Centred, and it names him — an empty pane should look deliberate and
          // tell you where you are, not just sit blank with two words in it.
          <div className="m-auto px-6 py-8 text-center">
            <div className="flex justify-center mb-3">
              <PeerAvatar peer={peer} size={56} />
            </div>
            <p className="text-sm font-semibold text-prose">
              This is the start of your conversation with {peerName}.
            </p>
            <p className="mt-1 text-xs text-prose-faint">Say hello.</p>
          </div>
        ) : (
          <div className="mt-auto py-4 space-y-1.5">
          {messages.map((m, i) => {
            const fromMe = m.sender_id === meId
            const prev = messages[i - 1]
            // Day separator when the calendar day changes (mount-gated to keep
            // SSR/CSR markup identical until locale formatting is safe).
            const showDay = mounted && (!prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString())
            // Avatar only at the start of a run of incoming messages.
            const runStart = !prev || prev.sender_id !== m.sender_id
            const showAvatar = !fromMe && runStart
            const hasImage = !!m.attachment_path
            const hasText = m.body.trim().length > 0
            const groups = groupsFor(m.id)
            const quoted = m.reply_to_id ? parentOf(m.reply_to_id) : null

            return (
              <div key={m.id} data-mid={m.id}>
                {showDay && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] font-semibold text-prose-faint bg-surface-raised rounded-full px-3 py-1">
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <div className={`group/msg flex items-end gap-1.5 ${fromMe ? 'justify-end' : 'justify-start'}`}>
                  {!fromMe && (
                    showAvatar
                      ? <PeerAvatar peer={peer} size={28} />
                      : <span className="w-7 shrink-0" aria-hidden />
                  )}

                  {/* Action trigger, on the OUTSIDE of the bubble so it never covers
                      text. Faintly visible on touch (no hover to discover it with)
                      and hover-revealed on pointer devices. */}
                  {fromMe && (
                    <ActionTrigger open={actionsFor === m.id} onClick={() => setActionsFor((a) => a === m.id ? null : m.id)} />
                  )}

                  <div className={`max-w-[75%] rounded-2xl text-sm break-words overflow-hidden ${
                    fromMe ? 'bg-accent text-white rounded-br-sm' : 'bg-surface-raised text-prose rounded-bl-sm'
                  } ${hasImage ? 'p-1' : 'px-3.5 py-2'}`}>
                    {/* Quoted parent. Tapping it jumps to the original when it's in
                        the loaded window. A null parent means the message was
                        deleted (reply_to_id is ON DELETE SET NULL) — say so rather
                        than rendering an empty quote. */}
                    {m.reply_to_id && (
                      <button
                        type="button"
                        onClick={() => quoted && scrollToMessage(quoted.id)}
                        className={`block w-full text-left mb-1 pl-2 border-l-2 ${hasImage ? 'mx-2.5 mt-1.5' : ''} ${
                          fromMe ? 'border-white/50' : 'border-accent'
                        }`}
                      >
                        <span className={`block text-[10px] font-bold ${fromMe ? 'text-white/80' : 'text-accent-text'}`}>
                          {quoted ? (quoted.sender_id === meId ? 'You' : peerName) : 'Reply'}
                        </span>
                        <span className={`block text-[11px] truncate ${fromMe ? 'text-white/70' : 'text-prose-muted'}`}>
                          {quoted ? snippetOf(quoted) : 'Original message was deleted'}
                        </span>
                      </button>
                    )}
                    {hasImage && (
                      <button type="button" onClick={() => setLightboxId(m.id)} className="block cursor-zoom-in" aria-label="View image">
                        {/* Private bucket — served via the participant-gated proxy, not a public URL. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/dm/attachment/${m.id}`}
                          alt={m.body || 'Photo'}
                          // Intrinsic dims reserve the right space BEFORE the bytes
                          // arrive, so loading images don't shift the scroll position.
                          width={m.attachment_width ?? undefined}
                          height={m.attachment_height ?? undefined}
                          className="block rounded-xl max-w-[15rem] sm:max-w-[18rem] max-h-[22rem] w-auto h-auto bg-surface"
                          // Eager, not lazy: in a short mobile scroll container a lazy
                          // image sits outside the intersection window and never loads.
                          // Keep pinned to the bottom only if we're already there.
                          onLoad={() => { if (stickToBottom.current) scrollToBottom() }}
                        />
                      </button>
                    )}
                    {hasText && (
                      <span className={`block whitespace-pre-wrap ${hasImage ? 'px-2.5 pt-1.5' : ''}`}>{m.body}</span>
                    )}
                    {mounted && (
                      <span className={`block text-[10px] mt-0.5 tabular-nums ${hasImage ? 'px-2.5 pb-1' : ''} ${fromMe ? 'text-white/60' : 'text-prose-faint'}`}>
                        {formatTime(m.created_at)}
                      </span>
                    )}
                  </div>

                  {!fromMe && (
                    <ActionTrigger open={actionsFor === m.id} onClick={() => setActionsFor((a) => a === m.id ? null : m.id)} />
                  )}
                </div>

                {/* Reaction chips. Tapping one toggles MY reaction of that kind, so
                    a chip is both a display and a control — which is what everyone
                    expects from it. Count only shows above 1; in a 1:1 thread the
                    ceiling is 2. */}
                {groups.length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${fromMe ? 'justify-end pr-1' : 'pl-[2.375rem]'}`}>
                    {groups.map((g) => (
                      <button
                        key={g.kind}
                        type="button"
                        onClick={() => react(m.id, g.kind as ReactionKind)}
                        aria-label={`${REACTIONS[g.kind as ReactionKind].label}${g.mine ? ' (yours)' : ''}`}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-none transition-colors ${
                          g.mine ? 'border-accent bg-accent/15' : 'border-soft bg-surface-raised hover:bg-surface-hover'
                        }`}
                      >
                        <span aria-hidden>{reactionEmoji(g.kind)}</span>
                        {g.users.length > 1 && (
                          <span className="text-prose-muted tabular-nums">{g.users.length}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Action row, INLINE rather than a floating popover: the message
                    list is its own scroll container, so an absolutely positioned
                    panel gets clipped at the top and bottom edges — exactly where
                    the newest and oldest messages live. Inline costs a small layout
                    shift and cannot be clipped. */}
                {actionsFor === m.id && (
                  <div className={`flex flex-wrap items-center gap-0.5 mt-1 ${fromMe ? 'justify-end' : 'pl-[2.375rem]'}`}>
                    {REACTION_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => { react(m.id, k); setActionsFor(null) }}
                        aria-label={REACTIONS[k].label}
                        className="min-w-9 min-h-9 inline-flex items-center justify-center rounded-full text-base hover:bg-surface-hover transition-colors"
                      >
                        <span aria-hidden>{REACTIONS[k].emoji}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setReplyToId(m.id); setActionsFor(null) }}
                      className="min-h-9 px-3 inline-flex items-center rounded-full text-xs font-semibold text-prose-muted hover:text-prose hover:bg-surface-hover transition-colors"
                    >
                      Reply
                    </button>
                  </div>
                )}

                {fromMe && i === lastMineIdx && peerHasSeenLast && (
                  <p className="text-right text-[10px] text-prose-faint mt-0.5 pr-1">Seen</p>
                )}
              </div>
            )
          })}
          </div>
        )}
      </div>

      {/* Composer */}
      {blocked ? (
        <p className="text-center text-xs text-prose-faint py-3 border-t border-soft">
          You blocked this member. Unblock from the menu to message again.
        </p>
      ) : (
        <div className="border-t border-soft pt-3">
          {error && <p className="text-xs text-danger-ink mb-1.5">{error}</p>}

          {/* What you're replying to, above the input — the standard place, and the
              only way the quote is visible at the moment you're writing it. */}
          {replyToId && (
            <div className="flex items-start gap-2 mb-2 pl-2 border-l-2 border-accent">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-accent-text uppercase tracking-wide">
                  Replying to {replyParent && replyParent.sender_id === meId ? 'yourself' : peerName}
                </p>
                <p className="text-xs text-prose-muted truncate">
                  {replyParent ? snippetOf(replyParent) : 'a message'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyToId(null)}
                aria-label="Cancel reply"
                className="p-1.5 text-prose-faint hover:text-prose rounded-lg hover:bg-surface-raised shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Staged image preview — sits above the input until sent or removed. */}
          {pendingImage && (
            <div className="relative inline-block mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingImage.previewUrl} alt="Attachment preview" className="max-h-28 w-auto rounded-lg border border-soft" />
              <button
                type="button"
                onClick={removePendingImage}
                aria-label="Remove image"
                className="absolute -top-2 -right-2 w-6 h-6 bg-surface border border-soft text-prose-muted hover:text-prose rounded-full flex items-center justify-center shadow"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={pickImage}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || !!pendingImage}
              aria-label="Attach a photo"
              className="p-2.5 text-prose-faint hover:text-accent disabled:opacity-40 rounded-xl hover:bg-surface-raised transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            {/* text-base, not text-sm: iOS Safari zooms the whole page when a
                focused input's font is under 16px, and there is no zooming back
                out of a fixed-height chat shell. Desktop takes sm at the md
                breakpoint, where no such zoom exists. */}
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => updateDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              rows={1}
              placeholder={pendingImage ? 'Add a caption…' : 'Write a message…'}
              className="flex-1 min-w-0 resize-none overflow-y-auto px-4 py-2.5 bg-surface border border-strong rounded-xl text-base md:text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover max-h-32"
            />
            <button type="button" onClick={send} disabled={sending || (!draft.trim() && !pendingImage)}
              className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors shrink-0">
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {lightboxId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/90 backdrop-blur-sm"
          onClick={() => setLightboxId(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/dm/attachment/${lightboxId}`}
            alt="Photo"
            className="max-w-full max-h-[85vh] object-contain rounded-lg select-none"
            style={{ touchAction: 'pinch-zoom' }}
            draggable={false}
          />
          <button
            type="button"
            onClick={() => setLightboxId(null)}
            aria-label="Close image"
            className="absolute top-3 right-3 w-9 h-9 bg-zinc-900/60 hover:bg-zinc-900/80 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Report modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/70" onClick={() => setReportOpen(false)}>
          <div className="bg-surface border border-soft rounded-xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-black text-prose">Report {peerName}</p>
            <p className="text-xs text-prose-muted">Pick a reason. Our team reviews every report.</p>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => submitReport(r)}
                  className="block w-full text-left px-3 py-2 text-sm text-prose bg-surface-raised hover:bg-surface rounded-lg transition-colors">
                  {r}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setReportOpen(false)} className="text-xs text-prose-faint hover:text-prose">Cancel</button>
          </div>
        </div>
      )}
      {reported && (
        <p className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-prose text-surface text-xs px-4 py-2 rounded-full shadow-lg">
          Report submitted — thank you.
        </p>
      )}
    </div>
  )
}

/**
 * The per-message "react or reply" handle.
 *
 * Three dots rather than a smiley, because this is CHROME and chrome is an SVG
 * (brand-guide §7.1) — the emoji live inside the row it opens, where they're
 * content. Faintly visible at all times on touch, since there is no hover to
 * discover it with, and revealed on hover for pointers.
 */
function ActionTrigger({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="React or reply"
      aria-expanded={open}
      className={`shrink-0 min-w-9 min-h-9 inline-flex items-center justify-center rounded-full text-prose-faint hover:text-prose hover:bg-surface-raised transition-all ${
        open ? 'opacity-100 text-prose' : 'opacity-60 sm:opacity-0 sm:group-hover/msg:opacity-100 focus-visible:opacity-100'
      }`}
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <circle cx="5" cy="12" r="1.75" /><circle cx="12" cy="12" r="1.75" /><circle cx="19" cy="12" r="1.75" />
      </svg>
    </button>
  )
}
