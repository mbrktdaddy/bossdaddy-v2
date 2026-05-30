'use client'

// DM thread: message list + composer, Realtime append, mark-read, and a
// block/unblock + report menu. Block enforcement is server-side (RLS + the
// sendMessage action); this UI just reflects + toggles it.

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { sendMessage, markConversationRead, blockUser, unblockUser, reportContent, deleteConversation } from '@/lib/messaging'

interface Message { id: string; sender_id: string; body: string; created_at: string }
interface Peer { id: string; username: string; displayName: string | null; avatarUrl: string | null }

const REPORT_REASONS = ['Spam', 'Harassment', 'Inappropriate content', 'Other']

export default function Thread({
  conversationId, meId, peer, initialMessages, initiallyBlocked,
}: {
  conversationId: string
  meId: string
  peer: Peer | null
  initialMessages: Message[]
  initiallyBlocked: boolean
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
  const bottomRef = useRef<HTMLDivElement>(null)

  const peerName = peer?.displayName || peer?.username || 'Member'

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Mark read on mount + whenever messages change.
  useEffect(() => { markConversationRead(conversationId) }, [conversationId, messages.length])
  useEffect(() => { scrollToBottom() }, [messages.length, scrollToBottom])

  // Realtime: append new messages in this conversation (dedupe by id).
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
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  async function send() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true); setError(null)
    const res = await sendMessage(conversationId, text)
    setSending(false)
    if (!res.ok) { setError(res.error); return }
    setDraft('')
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col h-[calc(100dvh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-soft">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/account/messages" className="text-prose-faint hover:text-prose text-sm">←</Link>
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
      <div className="flex-1 overflow-y-auto py-4 space-y-2">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-prose-faint py-8">Say hello 👋</p>
        ) : (
          messages.map((m) => {
            const fromMe = m.sender_id === meId
            return (
              <div key={m.id} className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                  fromMe ? 'bg-accent text-white rounded-br-sm' : 'bg-surface-raised text-prose rounded-bl-sm'
                }`}>
                  {m.body}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      {blocked ? (
        <p className="text-center text-xs text-prose-faint py-3 border-t border-soft">
          You blocked this member. Unblock from the menu to message again.
        </p>
      ) : (
        <div className="border-t border-soft pt-3">
          {error && <p className="text-xs text-danger-ink mb-1.5">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              rows={1}
              placeholder="Write a message…"
              className="flex-1 resize-none px-4 py-2.5 bg-surface border border-strong rounded-xl text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover max-h-32"
            />
            <button type="button" onClick={send} disabled={sending || !draft.trim()}
              className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors shrink-0">
              {sending ? '…' : 'Send'}
            </button>
          </div>
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
