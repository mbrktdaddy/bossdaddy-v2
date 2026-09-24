'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteBossConversations } from '../actions'

export type PastChat = { id: string; title: string | null; updated_at: string }

// The member's saved conversations, above the chat. Collapsed by default so the
// chat stays the first thing on a phone; the list itself only renders when open,
// which also keeps the locale-formatted dates out of the server render (no
// hydration mismatch). Opening a chat is a plain navigation to ?c=<id> — the
// page loads it server-side.
//
// Two ways to delete: the trash button on a row (one chat), or Select mode —
// checkboxes + "Delete (n)" — for several at once.
export default function PastChats({ chats, activeId }: { chats: PastChat[]; activeId: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()

  const visible = chats.filter((c) => !removed.has(c.id))
  const allSelected = visible.length > 0 && visible.every((c) => selected.has(c.id))

  function exitSelect() {
    setSelecting(false)
    setSelected(new Set())
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function remove(ids: string[]) {
    if (ids.length === 0) return
    const prompt =
      ids.length === 1 ? 'Delete this chat? This can’t be undone.' : `Delete ${ids.length} chats? This can’t be undone.`
    if (!window.confirm(prompt)) return
    setFailed(false)
    setRemoved((prev) => new Set([...prev, ...ids]))
    startTransition(async () => {
      const { ok } = await deleteBossConversations(ids)
      if (!ok) {
        // Put them back and say so — never let a failed delete look done.
        setRemoved((prev) => new Set([...prev].filter((id) => !ids.includes(id))))
        setFailed(true)
        return
      }
      exitSelect()
      if (activeId && ids.includes(activeId)) router.push('/tools/the-boss')
      else router.refresh()
    })
  }

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o)
            exitSelect()
          }}
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

      {failed && <p className="mb-2 text-xs text-danger-ink">Couldn’t delete. Try again in a sec.</p>}

      {open && visible.length > 0 && (
        <div id="boss-past-chats" className="border border-soft rounded-2xl bg-surface overflow-hidden">
          {/* Toolbar: enter/leave Select mode; in it, select all + bulk delete. */}
          <div className="flex items-center justify-between gap-2 px-2 border-b border-soft">
            {selecting ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelected(allSelected ? new Set() : new Set(visible.map((c) => c.id)))}
                  className="text-sm font-semibold text-prose hover:text-accent px-2 py-3 min-h-[44px] transition-colors"
                >
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={exitSelect}
                    className="text-sm font-semibold text-prose-muted hover:text-prose px-2 py-3 min-h-[44px] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => remove([...selected])}
                    disabled={selected.size === 0 || pending}
                    className="text-sm font-semibold text-danger-ink hover:underline disabled:opacity-40 disabled:no-underline px-2 py-3 min-h-[44px]"
                  >
                    Delete{selected.size > 0 ? ` (${selected.size})` : ''}
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setSelecting(true)}
                className="ml-auto text-sm font-semibold text-prose-muted hover:text-prose px-2 py-3 min-h-[44px] transition-colors"
              >
                Select
              </button>
            )}
          </div>

          <ul className="divide-y divide-soft max-h-72 overflow-y-auto">
            {visible.map((c) => {
              const active = c.id === activeId
              const title = c.title?.trim() || 'Untitled chat'
              const date = new Date(c.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

              if (selecting) {
                const checked = selected.has(c.id)
                return (
                  <li key={c.id}>
                    <label className="flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm text-prose cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(c.id)}
                        className="h-5 w-5 shrink-0 accent-[var(--bd-orange)]"
                      />
                      <span className="flex-1 min-w-0 truncate">{title}</span>
                      <span className="shrink-0 text-xs text-prose-faint">{date}</span>
                    </label>
                  </li>
                )
              }

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
                    <span className="shrink-0 text-xs text-prose-faint">{date}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove([c.id])}
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
        </div>
      )}
    </div>
  )
}
