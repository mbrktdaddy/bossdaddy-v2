'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteBossConversation } from '../actions'

export type PastChat = { id: string; title: string | null; updated_at: string }

// The member's saved conversations, above the chat. Collapsed by default so the
// chat stays the first thing on a phone; the list itself only renders when open,
// which also keeps the locale-formatted dates out of the server render (no
// hydration mismatch). Opening a chat is a plain navigation to ?c=<id> — the
// page loads it server-side.
export default function PastChats({ chats, activeId }: { chats: PastChat[]; activeId: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState(false)
  const [, startTransition] = useTransition()

  const visible = chats.filter((c) => !removed.has(c.id))

  function remove(id: string) {
    if (!window.confirm('Delete this chat? This can’t be undone.')) return
    setFailed(false)
    setRemoved((prev) => new Set(prev).add(id))
    startTransition(async () => {
      const { ok } = await deleteBossConversation(id)
      if (!ok) {
        // Put it back and say so — never let a failed delete look done.
        setRemoved((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        setFailed(true)
        return
      }
      if (id === activeId) router.push('/tools/the-boss')
      else router.refresh()
    })
  }

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="boss-past-chats"
          disabled={visible.length === 0}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-prose hover:text-accent disabled:text-prose-faint disabled:hover:text-prose-faint px-1 py-3 min-h-[44px] transition-colors"
        >
          {visible.length === 0 ? 'No past chats yet' : `Past chats (${visible.length})`}
          {visible.length > 0 && (
            <svg
              className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          )}
        </button>
        {activeId && (
          <Link
            href="/tools/the-boss"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline px-1 py-3 min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
            New chat
          </Link>
        )}
      </div>

      {failed && <p className="mb-2 text-xs text-danger-ink">Couldn’t delete that chat. Try again in a sec.</p>}

      {open && visible.length > 0 && (
        <ul
          id="boss-past-chats"
          className="border border-soft rounded-2xl bg-surface divide-y divide-soft max-h-72 overflow-y-auto"
        >
          {visible.map((c) => {
            const active = c.id === activeId
            const title = c.title?.trim() || 'Untitled chat'
            return (
              <li key={c.id} className="flex items-center">
                <Link
                  href={`/tools/the-boss?c=${c.id}`}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex-1 min-w-0 flex items-center justify-between gap-3 pl-4 pr-2 py-3 min-h-[44px] text-sm transition-colors ${
                    active ? 'text-accent' : 'text-prose hover:text-accent'
                  }`}
                >
                  <span className="truncate">{title}</span>
                  <span className="shrink-0 text-xs text-prose-faint">
                    {new Date(c.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  aria-label={`Delete chat: ${title}`}
                  title="Delete chat"
                  className="shrink-0 inline-flex h-11 w-11 items-center justify-center text-prose-faint hover:text-danger-ink transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"
                    />
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
