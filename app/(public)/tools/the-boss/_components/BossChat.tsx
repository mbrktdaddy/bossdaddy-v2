'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Block, BossStreamEvent } from '@/lib/boss/types'
import { normalizeBossText } from '@/lib/boss/normalizeText'
import BossBlocks from './BossBlocks'

// `failed` = a hard failure with no streamed text (the whole bubble is the error).
// `errorNote` = a mid-stream cutoff AFTER text arrived — keep what streamed and
// show a short note below it, never wipe the partial answer.
// `messageId` = the persisted boss_messages id (members only, arrives on `done`);
// its presence is what gates the thumbs. `feedback` = the member's rating.
type Msg = {
  role: 'user' | 'assistant'
  content: string
  citations?: Block[]
  errorNote?: string
  failed?: boolean
  messageId?: string | null
  feedback?: 'up' | 'down' | null
}

const DRAFT_KEY = 'bd_boss_draft'
const EXAMPLES = [
  'Best stroller you’ve tested under $300?',
  'How do I fix a squeaky door hinge?',
  'Plan a Saturday with a 3-year-old.',
  'Help me write a quick birthday toast for my dad.',
]

export default function BossChat({ isMember, seedContext }: { isMember: boolean; seedContext?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [convId, setConvId] = useState<string | null>(null)
  const [quota, setQuota] = useState(false)
  const [toolNote, setToolNote] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(DRAFT_KEY) : null
    if (saved) setInput(saved)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, toolNote])

  function updateLastAssistant(fn: (m: Msg) => Msg) {
    setMsgs((prev) => {
      const copy = [...prev]
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'assistant') {
          copy[i] = fn(copy[i])
          break
        }
      }
      return copy
    })
  }

  function handleEvent(ev: BossStreamEvent) {
    switch (ev.type) {
      case 'text':
        updateLastAssistant((m) => ({ ...m, content: m.content + ev.delta }))
        break
      case 'tool_start':
        setToolNote(
          ev.name === 'search_gear'
            ? 'Checking the vault…'
            : ev.name === 'research_gear'
              ? 'Searching the web for current picks — give me a few seconds…'
              : 'Pulling up guides…',
        )
        break
      // `blocks` is the current channel; `citations` is the legacy event name kept
      // until the agent migration (PR 1 step 2). The renderer accepts both.
      case 'blocks':
      case 'citations':
        updateLastAssistant((m) => ({ ...m, citations: [...(m.citations ?? []), ...ev.items] }))
        break
      case 'done':
        if (ev.conversationId) setConvId(ev.conversationId)
        if (ev.messageId) updateLastAssistant((m) => ({ ...m, messageId: ev.messageId }))
        break
      case 'error':
        updateLastAssistant((m) =>
          m.content.trim()
            ? { ...m, errorNote: ev.message } // keep the partial answer, note the cutoff
            : { ...m, content: ev.message, failed: true },
        )
        break
      case 'quota_exhausted':
        setQuota(true)
        // Drop the empty assistant placeholder we optimistically added.
        setMsgs((prev) => (prev.length && prev[prev.length - 1].content === '' ? prev.slice(0, -1) : prev))
        break
    }
  }

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy || quota) return

    const isFirst = msgs.length === 0
    // Visitors carry their own short history; members continue via conversationId.
    const history = !isMember ? msgs.slice(-12).map((m) => ({ role: m.role, content: m.content })) : undefined

    setMsgs((prev) => [...prev, { role: 'user', content: trimmed }, { role: 'assistant', content: '' }])
    setInput('')
    if (typeof window !== 'undefined') window.localStorage.removeItem(DRAFT_KEY)
    setBusy(true)
    setToolNote(null)

    try {
      const res = await fetch('/api/boss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          conversationId: convId ?? undefined,
          history,
          context: isFirst ? seedContext : undefined,
        }),
      })
      if (!res.body) throw new Error('no body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          const json = line.slice(5).trim()
          if (!json) continue
          try {
            handleEvent(JSON.parse(json) as BossStreamEvent)
          } catch {
            /* ignore malformed frame */
          }
        }
      }
    } catch {
      updateLastAssistant((m) =>
        m.content.trim()
          ? { ...m, errorNote: 'The Boss got cut off. Give it another shot.' }
          : { ...m, content: 'The Boss hit a snag. Give it another shot.', failed: true },
      )
    } finally {
      setBusy(false)
      setToolNote(null)
    }
  }

  // Thumbs on a persisted assistant turn (members only). Optimistic + best-effort:
  // clicking the active rating again clears it. A failed PATCH leaves the optimistic
  // state — a lost thumb isn't worth interrupting the conversation over.
  function rate(messageId: string, value: 'up' | 'down') {
    const current = msgs.find((m) => m.messageId === messageId)?.feedback ?? null
    const next = current === value ? null : value
    setMsgs((prev) => prev.map((m) => (m.messageId === messageId ? { ...m, feedback: next } : m)))
    void fetch('/api/boss/feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, feedback: next }),
    }).catch(() => {})
  }

  return (
    <div className="flex flex-col border border-soft rounded-2xl bg-surface-raised overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[42vh] max-h-[60vh]">
        {msgs.length === 0 && !quota && (
          <div className="py-6">
            <p className="text-sm text-prose-muted mb-3">Ask about gear, how-to, planning, writing — or just dad life.</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => send(ex)}
                  className="text-sm text-prose border border-soft hover:border-accent rounded-full px-3 py-2 bg-surface transition-colors min-h-[44px]"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={m.role === 'user' ? 'max-w-[85%]' : 'max-w-[92%] w-full'}>
              <div
                className={
                  m.role === 'user'
                    ? 'bg-accent text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap'
                    : `rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        m.failed ? 'bg-danger-bg text-danger-ink border border-danger-line' : 'bg-surface text-prose border border-soft'
                      }`
                }
              >
                {/* Assistant prose is normalized (markdown backstop); user text is shown verbatim. */}
                {(m.role === 'assistant' ? normalizeBossText(m.content) : m.content) ||
                  (busy && i === msgs.length - 1 ? <span className="text-prose-faint">{toolNote ?? 'Thinking…'}</span> : '')}
              </div>
              {m.errorNote && <p className="mt-1 text-[11px] text-danger-ink">{m.errorNote}</p>}
              {m.citations && m.citations.length > 0 && (
                <BossBlocks items={m.citations} query={i > 0 ? msgs[i - 1]?.content : undefined} />
              )}
              {isMember && m.role === 'assistant' && m.messageId && !m.failed && (
                <div className="mt-1.5 flex items-center gap-0.5">
                  <FeedbackButton
                    kind="up"
                    active={m.feedback === 'up'}
                    onClick={() => rate(m.messageId!, 'up')}
                  />
                  <FeedbackButton
                    kind="down"
                    active={m.feedback === 'down'}
                    onClick={() => rate(m.messageId!, 'down')}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {quota ? (
        <div className="border-t border-soft p-4 bg-surface">
          <p className="text-sm font-semibold text-prose mb-1">That’s the free taste.</p>
          <p className="text-sm text-prose-muted mb-3">Create a free account to keep asking the Boss.</p>
          <div className="flex gap-2">
            <Link href="/register?next=/tools/the-boss" className="text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg px-4 py-2.5 min-h-[44px] inline-flex items-center transition-colors">
              Create free account
            </Link>
            <Link href="/login?next=/tools/the-boss" className="text-sm font-semibold text-accent hover:underline px-3 py-2.5 min-h-[44px] inline-flex items-center">
              Sign in
            </Link>
          </div>
        </div>
      ) : (
        <div className="border-t border-soft p-3 bg-surface">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                if (typeof window !== 'undefined') window.localStorage.setItem(DRAFT_KEY, e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              rows={1}
              placeholder="Ask the Boss…"
              className="flex-1 resize-none bg-surface-raised border border-soft rounded-xl px-3 py-2.5 text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:border-accent max-h-32"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="shrink-0 text-sm font-semibold text-white bg-accent hover:bg-accent-hover disabled:opacity-40 rounded-xl px-4 py-2.5 min-h-[44px] transition-colors"
            >
              {busy ? '…' : 'Ask'}
            </button>
          </form>
          <p className="mt-2 text-[11px] text-prose-faint">
            General info and one dad’s take — not professional advice. Some links earn a commission.
          </p>
        </div>
      )}
    </div>
  )
}

// Inline outlined thumb (no emoji — see brand rule). 44px hit area; the icon fills
// with the accent when active. `aria-pressed` announces the current rating.
function FeedbackButton({
  kind,
  active,
  onClick,
}: {
  kind: 'up' | 'down'
  active: boolean
  onClick: () => void
}) {
  const label = kind === 'up' ? 'Helpful' : 'Not helpful'
  const path =
    kind === 'up'
      ? 'M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904M14 9h2.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z'
      : 'M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 0 1-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398C20.613 14.547 19.833 15 19 15h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 0 0 .303-.54m.023-8.25H16.48a4.5 4.5 0 0 1-1.423-.23l-3.114-1.04a4.5 4.5 0 0 0-1.423-.23H6.504c-.618 0-1.217.247-1.605.729A11.95 11.95 0 0 0 2.25 12c0 .434.023.863.068 1.285C2.427 14.306 3.346 15 4.372 15h3.126c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.5a2.25 2.25 0 0 0 2.25 2.25.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
        active ? 'text-accent' : 'text-prose-faint hover:text-prose'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </button>
  )
}
