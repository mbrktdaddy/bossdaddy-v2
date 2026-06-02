'use client'

import { useState } from 'react'
import {
  PHRASE_KINDS,
  PHRASE_KIND_LABEL,
  AVOID_CONTEXTS,
  AVOID_CONTEXT_LABEL,
  type VoicePhrase,
  type PhraseKind,
  type AvoidContext,
} from '@/lib/voiceLexicon'

interface Props {
  initial: VoicePhrase[]
}

const inputCls =
  'w-full px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover'

export function SignaturePhrasesManager({ initial }: Props) {
  const [phrases, setPhrases] = useState<VoicePhrase[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Add-form state
  const [newText, setNewText] = useState('')
  const [newKind, setNewKind] = useState<PhraseKind>('phrase')
  const [adding, setAdding] = useState(false)

  async function addPhrase() {
    const text = newText.trim()
    if (text.length < 2) return
    setAdding(true); setError(null)
    try {
      const res = await fetch('/api/voice/phrases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Author adds it by hand → it's approved (the act of adding is approval).
        body: JSON.stringify({ text, kind: newKind, capture: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      const saved = json.phrase as VoicePhrase
      setPhrases((list) => {
        const without = list.filter((p) => p.id !== saved.id)
        return [saved, ...without]
      })
      setNewText(''); setNewKind('phrase')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setAdding(false)
    }
  }

  async function patch(id: string, body: Partial<VoicePhrase>) {
    setBusyId(id); setError(null)
    try {
      const res = await fetch(`/api/voice/phrases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Update failed')
      const saved = json.phrase as VoicePhrase
      setPhrases((list) => list.map((p) => (p.id === id ? saved : p)))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this phrase? Claude will stop using it.')) return
    setBusyId(id); setError(null)
    try {
      const res = await fetch(`/api/voice/phrases/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Delete failed')
      }
      setPhrases((list) => list.filter((p) => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const approved = phrases.filter((p) => p.status === 'approved')
  const proposed = phrases.filter((p) => p.status === 'proposed')

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-black mb-1">Signature phrases</h2>
        <p className="text-xs text-prose-faint">
          Your own one-liners, slang, openers, and bits. Claude weaves a few of these into drafts
          where they land naturally — and drops them entirely on sensitive topics. Highlight a line
          in any review editor and hit <strong>★ Save to my voice</strong> to capture it on the fly.
        </p>
      </div>

      {/* Add form */}
      <div className="bg-surface border border-soft rounded-xl p-3 space-y-2">
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder={'Type a phrase you actually say — e.g. "I\'m not here to sell you the moon."'}
          rows={2}
          className={`${inputCls} resize-y`}
        />
        <div className="flex items-center gap-2">
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as PhraseKind)}
            className="px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-sm text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
          >
            {PHRASE_KINDS.map((k) => (
              <option key={k} value={k}>{PHRASE_KIND_LABEL[k]}</option>
            ))}
          </select>
          <div className="flex-1" />
          <button
            type="button"
            onClick={addPhrase}
            disabled={adding || newText.trim().length < 2}
            className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {adding ? 'Adding…' : '+ Add phrase'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-danger-ink">{error}</p>}

      {/* Proposed queue — only shown when something is waiting for review */}
      {proposed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-prose-faint">
            Waiting for your OK ({proposed.length})
          </p>
          {proposed.map((p) => (
            <PhraseRow
              key={p.id}
              phrase={p}
              editing={editingId === p.id}
              busy={busyId === p.id}
              onEdit={() => setEditingId(p.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={(body) => patch(p.id, body)}
              onApprove={() => patch(p.id, { status: 'approved' })}
              onArchive={() => patch(p.id, { status: 'archived' })}
              onDelete={() => remove(p.id)}
            />
          ))}
        </div>
      )}

      {/* Approved lexicon */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-prose-faint">
          In use ({approved.length})
        </p>
        {approved.length === 0 ? (
          <p className="text-sm text-prose-faint italic">
            No phrases yet. Add one above, or capture them as you edit reviews.
          </p>
        ) : (
          approved.map((p) => (
            <PhraseRow
              key={p.id}
              phrase={p}
              editing={editingId === p.id}
              busy={busyId === p.id}
              onEdit={() => setEditingId(p.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={(body) => patch(p.id, body)}
              onArchive={() => patch(p.id, { status: 'archived' })}
              onDelete={() => remove(p.id)}
            />
          ))
        )}
      </div>
    </section>
  )
}

function PhraseRow({
  phrase,
  editing,
  busy,
  onEdit,
  onCancelEdit,
  onSave,
  onApprove,
  onArchive,
  onDelete,
}: {
  phrase: VoicePhrase
  editing: boolean
  busy: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onSave: (body: Partial<VoicePhrase>) => void
  onApprove?: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const [text, setText]   = useState(phrase.text)
  const [kind, setKind]   = useState<PhraseKind>(phrase.kind)
  const [tone, setTone]   = useState(phrase.tone ?? '')
  const [avoid, setAvoid] = useState<AvoidContext[]>(
    (phrase.contexts_avoid ?? []).filter((c): c is AvoidContext =>
      (AVOID_CONTEXTS as readonly string[]).includes(c)),
  )

  function toggleAvoid(c: AvoidContext) {
    setAvoid((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]))
  }

  if (editing) {
    return (
      <div className="bg-surface border border-accent-border/40 rounded-xl p-3 space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className={`${inputCls} resize-y`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as PhraseKind)}
            className="px-3 py-2 bg-surface-sunken border border-soft rounded-lg text-sm text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
          >
            {PHRASE_KINDS.map((k) => (
              <option key={k} value={k}>{PHRASE_KIND_LABEL[k]}</option>
            ))}
          </select>
          <input
            type="text"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Tone (optional) — e.g. dry, warm ribbing"
            className={`${inputCls} flex-1 min-w-[160px]`}
          />
        </div>
        <div>
          <p className="text-xs text-prose-faint mb-1.5">Don&rsquo;t use on:</p>
          <div className="flex flex-wrap gap-1.5">
            {AVOID_CONTEXTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleAvoid(c)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  avoid.includes(c)
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface-sunken text-prose-muted border-soft hover:border-strong'
                }`}
              >
                {AVOID_CONTEXT_LABEL[c]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-3 py-1.5 text-xs text-prose-muted hover:text-prose rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || text.trim().length < 2}
            onClick={() => onSave({ text: text.trim(), kind, tone: tone.trim() || null, contexts_avoid: avoid })}
            className="px-4 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  const avoidTags = (phrase.contexts_avoid ?? []).filter(Boolean)

  return (
    <div className="bg-surface border border-soft rounded-xl p-3 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-prose">&ldquo;{phrase.text}&rdquo;</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-surface-sunken border border-soft text-prose-faint">
            {PHRASE_KIND_LABEL[phrase.kind]}
          </span>
          {phrase.tone && <span className="text-prose-faint">{phrase.tone}</span>}
          {avoidTags.length > 0 && (
            <span className="text-prose-faint">· avoid on {avoidTags.join(', ')}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onApprove && (
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="px-2.5 py-1.5 text-xs font-semibold text-forest hover:bg-surface-sunken rounded-lg transition-colors disabled:opacity-40"
            title="Approve — start using this"
          >
            ✓ Approve
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onEdit}
          className="px-2 py-1.5 text-xs text-prose-muted hover:text-prose hover:bg-surface-sunken rounded-lg transition-colors disabled:opacity-40"
          title="Edit"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onArchive}
          className="px-2 py-1.5 text-xs text-prose-muted hover:text-prose hover:bg-surface-sunken rounded-lg transition-colors disabled:opacity-40"
          title="Archive — stop using, but keep the record"
        >
          Archive
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="px-2 py-1.5 text-xs text-danger-ink hover:bg-surface-sunken rounded-lg transition-colors disabled:opacity-40"
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
