'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { withWeeks, formatNoteDate, TESTING_NOTE_MAX, type TestingNote } from '@/lib/products/testing-notes'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { buttonVariants } from '@/components/ui/Button'

interface Props {
  productId: string
  initialNotes: TestingNote[]
}

const INPUT = 'w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover'

// Today in the browser's zone, as YYYY-MM-DD. Called from event handlers only,
// never during render, so the server pass can't bake in a UTC date.
function todayLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Testing notes (mig 158): dated public field notes on a product under test,
 * shown on its Bench page ("Week 2: battery's holding up"). Lives outside the
 * product <form> so its inputs and buttons can't submit the product.
 */
export function TestingNotesPanel({ productId, initialNotes }: Props) {
  const router = useRouter()
  const [notes, setNotes]       = useState<TestingNote[]>(initialNotes)
  const [notedOn, setNotedOn]   = useState('')
  const [body, setBody]         = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody]   = useState('')
  const [editDate, setEditDate]   = useState('')

  const base = `/api/admin/products/${productId}/notes`

  async function call(url: string, init: RequestInit): Promise<{ note?: TestingNote } | null> {
    setBusy(true); setError(null)
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Request failed')
      router.refresh()
      return json
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function addNote() {
    if (!body.trim()) return
    const json = await call(base, {
      method: 'POST',
      body: JSON.stringify({ noted_on: notedOn || todayLocal(), body: body.trim() }),
    })
    if (json?.note) {
      setNotes((prev) => [json.note!, ...prev])
      setBody(''); setNotedOn('')
    }
  }

  async function saveEdit(id: string) {
    if (!editBody.trim()) return
    const json = await call(`${base}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ body: editBody.trim(), ...(editDate ? { noted_on: editDate } : {}) }),
    })
    if (json?.note) {
      setNotes((prev) => prev.map((n) => (n.id === id ? json.note! : n)))
      setEditingId(null)
    }
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this testing note? It disappears from the public Bench page.')) return
    const json = await call(`${base}/${id}`, { method: 'DELETE' })
    if (json) setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <Card tone="sunken" className="p-4 space-y-4 mt-8">
      <div>
        <Eyebrow>Testing Notes</Eyebrow>
        <p className="mt-0.5 text-xs text-prose-faint">
          Dated field notes, shown publicly on the product&apos;s Bench page. Weeks count from your first note.
        </p>
      </div>

      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={TESTING_NOTE_MAX}
          rows={3}
          placeholder="Battery's holding up after a week of daily use. Clip is already loosening."
          className={`${INPUT} resize-none`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={notedOn}
            onChange={(e) => setNotedOn(e.target.value)}
            aria-label="Note date (blank = today)"
            className={`${INPUT} w-auto`}
          />
          <span className="text-xs text-prose-faint">Blank date = today · {body.length}/{TESTING_NOTE_MAX}</span>
          <button
            type="button"
            onClick={addNote}
            disabled={busy || !body.trim()}
            className={buttonVariants({ size: 'sm', className: 'ml-auto' })}
          >
            Add note
          </button>
        </div>
      </div>

      {error && (
        <p className="text-danger-ink text-sm bg-danger-bg border border-danger-line rounded-lg px-4 py-3">{error}</p>
      )}

      {notes.length === 0 ? (
        <p className="text-xs text-prose-faint italic">No notes yet.</p>
      ) : (
        <ol className="space-y-3">
          {withWeeks(notes).map((n) => (
            <li key={n.id} className="border-t border-soft pt-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-bold text-prose">Week {n.week}</span>
                <span className="text-prose-faint">{formatNoteDate(n.noted_on)}</span>
                {editingId !== n.id && (
                  <span className="ml-auto flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setEditingId(n.id); setEditBody(n.body); setEditDate(n.noted_on) }}
                      className="text-prose-muted hover:text-prose transition-colors py-1"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNote(n.id)}
                      disabled={busy}
                      className="text-danger-ink hover:text-danger-ink transition-colors py-1 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </span>
                )}
              </div>
              {editingId === n.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    maxLength={TESTING_NOTE_MAX}
                    rows={3}
                    className={`${INPUT} resize-none`}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      aria-label="Note date"
                      className={`${INPUT} w-auto`}
                    />
                    <button type="button" onClick={() => saveEdit(n.id)} disabled={busy || !editBody.trim()} className={buttonVariants({ size: 'sm' })}>
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className={buttonVariants({ size: 'sm', variant: 'secondary' })}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm text-prose-muted whitespace-pre-line">{n.body}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
