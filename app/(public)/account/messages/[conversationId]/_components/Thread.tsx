'use client'

// DM thread: message list + composer, Realtime append, mark-read, and a
// block/unblock + report menu. Block enforcement is server-side (RLS + the
// sendMessage action); this UI just reflects + toggles it.

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { sendMessage, markConversationRead, blockUser, unblockUser, reportContent, deleteConversation } from '@/lib/messaging'

interface Message {
  id: string
  sender_id: string
  body: string
  created_at: string
  attachment_path: string | null
  attachment_width: number | null
  attachment_height: number | null
}
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

export default function Thread({
  conversationId, meId, peer, initialMessages, initiallyBlocked, initialPeerLastReadAt,
}: {
  conversationId: string
  meId: string
  peer: Peer | null
  initialMessages: Message[]
  initiallyBlocked: boolean
  initialPeerLastReadAt: string | null
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(initiallyBlocked)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reported, setReported] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(initialPeerLastReadAt)
  // Pending image attachment (one per message) + its object-URL preview. The
  // draft textarea doubles as an optional caption while one is staged.
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null)
  // Message id whose image is open in the lightbox (null = closed).
  const [lightboxId, setLightboxId] = useState<string | null>(null)
  // Gate locale-formatted timestamps behind mount so SSR (server timezone) and
  // the client's first paint match — avoids a hydration mismatch on the times.
  const [mounted, setMounted] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Mark read on mount + whenever messages change.
  useEffect(() => { markConversationRead(conversationId) }, [conversationId, messages.length])
  useEffect(() => { scrollToBottom() }, [messages.length, scrollToBottom])

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!lightboxId) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setLightboxId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxId])

  // Revoke the staged preview URL if the thread unmounts mid-compose.
  useEffect(() => () => { if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl) }, [pendingImage])

  // Realtime: append new messages + track the peer's read state (for "Seen").
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

    if (pendingImage) {
      setSending(true); setError(null)
      try {
        const fd = new FormData()
        fd.append('conversationId', conversationId)
        fd.append('file', pendingImage.file)
        if (text) fd.append('caption', text)
        const res = await fetch('/api/dm/upload', { method: 'POST', body: fd })
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) { setError(json.error || 'Could not send image'); setSending(false); return }
        removePendingImage()
        clearDraft()
      } catch {
        setError('Could not send image — please try again')
      }
      setSending(false)
      return
    }

    if (!text) return
    setSending(true); setError(null)
    const res = await sendMessage(conversationId, text)
    setSending(false)
    if (!res.ok) { setError(res.error); return }
    clearDraft()
    // Realtime will append; nothing else to do.
  }

  async function toggleBlock() {
    setMenuOpen(false)
    if (!peer) return
    if (blocked) { await unblockUser(peer.id); setBlocked(false) }
    else { await blockUser(peer.id); setBlocked(true) }
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

  // Index of my most recent message — the only one that can show "Seen".
  let lastMineIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_id === meId) { lastMineIdx = i; break }
  }
  const peerHasSeenLast =
    lastMineIdx >= 0 &&
    !!peerLastReadAt &&
    new Date(peerLastReadAt).getTime() >= new Date(messages[lastMineIdx].created_at).getTime()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col h-[calc(100dvh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-soft">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/account/messages" className="text-prose-faint hover:text-prose text-sm">←</Link>
          <PeerAvatar peer={peer} size={28} />
          {peer ? (
            <Link href={`/author/${peer.username}`} className="text-sm font-bold text-prose truncate hover:text-accent">{peerName}</Link>
          ) : (
            <span className="text-sm font-bold text-prose">{peerName}</span>
          )}
        </div>
        {peer && (
          <div className="relative">
            <button type="button" onClick={() => { setMenuOpen((o) => !o); setConfirmDelete(false) }} aria-label="Conversation options"
              className="p-1.5 text-prose-faint hover:text-prose rounded-lg hover:bg-surface-raised">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-surface border border-soft rounded-xl shadow-xl z-20 overflow-hidden">
                <button type="button" onClick={toggleBlock} className="block w-full text-left px-4 py-2.5 text-sm text-prose hover:bg-surface-raised">
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

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto py-4 space-y-1.5">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-prose-faint py-8">Say hello 👋</p>
        ) : (
          messages.map((m, i) => {
            const fromMe = m.sender_id === meId
            const prev = messages[i - 1]
            // Day separator when the calendar day changes (mount-gated to keep
            // SSR/CSR markup identical until locale formatting is safe).
            const showDay = mounted && (!prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString())
            // Avatar only at the start of a run of incoming messages.
            const runStart = !prev || prev.sender_id !== m.sender_id
            const showAvatar = !fromMe && runStart

            return (
              <div key={m.id}>
                {showDay && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] font-semibold text-prose-faint bg-surface-raised rounded-full px-3 py-1">
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex items-end gap-2 ${fromMe ? 'justify-end' : 'justify-start'}`}>
                  {!fromMe && (
                    showAvatar
                      ? <PeerAvatar peer={peer} size={28} />
                      : <span className="w-7 shrink-0" aria-hidden />
                  )}
                  {(() => {
                    const hasImage = !!m.attachment_path
                    const hasText = m.body.trim().length > 0
                    return (
                      <div className={`group max-w-[75%] rounded-2xl text-sm break-words overflow-hidden ${
                        fromMe ? 'bg-accent text-white rounded-br-sm' : 'bg-surface-raised text-prose rounded-bl-sm'
                      } ${hasImage ? 'p-1' : 'px-3.5 py-2'}`}>
                        {hasImage && (
                          <button type="button" onClick={() => setLightboxId(m.id)} className="block cursor-zoom-in" aria-label="View image">
                            {/* Private bucket — served via the participant-gated proxy, not a public URL. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/dm/attachment/${m.id}`}
                              alt={m.body || 'Photo'}
                              className="block rounded-xl max-w-[15rem] sm:max-w-[18rem] max-h-[22rem] w-auto h-auto bg-surface"
                              style={m.attachment_width && m.attachment_height ? { aspectRatio: `${m.attachment_width} / ${m.attachment_height}` } : undefined}
                              loading="lazy"
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
                    )
                  })()}
                </div>
                {fromMe && i === lastMineIdx && peerHasSeenLast && (
                  <p className="text-right text-[10px] text-prose-faint mt-0.5 pr-1">Seen</p>
                )}
              </div>
            )
          })
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
            <textarea
              value={draft}
              onChange={(e) => updateDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              rows={1}
              placeholder={pendingImage ? 'Add a caption…' : 'Write a message…'}
              className="flex-1 resize-none px-4 py-2.5 bg-surface border border-strong rounded-xl text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover max-h-32"
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
