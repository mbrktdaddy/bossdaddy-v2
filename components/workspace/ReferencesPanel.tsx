'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { fieldClass } from '@/components/ui/Field'
import { buttonVariants } from '@/components/ui/Button'
import { XIcon } from '@/components/icons'
import {
  MAX_REFERENCES, MAX_REF_LABEL_LEN, MAX_REF_NOTE_LEN, MAX_REF_TEXT_LEN, MIN_REF_TEXT_LEN,
  hostOf, isRetailerUrl, mergeReferenceNotes, normalizeLinkInput, pruneReferenceNotes, referenceKey,
  unfetchedReferences, type ReferenceInput, type ReferenceNote,
} from '@/lib/content/references'

// References for a draft (docs/content-pipeline-plan.md §4a). The author lists as
// many as they like (up to MAX_REFERENCES) — a link, or pasted text for a page
// that can't be fetched — each with an optional "what I want from it" line. They
// are read at Generate (or on the Read tap), and the distilled facts are reviewed
// per reference. Links pasted into the notes are offered with one tap. Retailer
// links are flagged, not fetched — the product panel owns those.

interface Props {
  contentType: 'review' | 'guide'
  /** The piece's subject (product name / topic) — steers the extraction. */
  subject: string
  references: ReferenceInput[]
  notes: ReferenceNote[]
  onChange: (refs: ReferenceInput[], notes: ReferenceNote[]) => void
  /** Links found in the author's notes text — offered with one tap. */
  detected?: string[]
}

// "dewalt.com/x" is a link too: the scheme is added, then it must be a plain web address.
const validUrl = normalizeLinkInput

/**
 * Read references through /api/content/references. Shared with the wizards, which
 * read any still-unread reference at Generate so a listed one can never silently
 * go unused.
 */
export async function readReferences(input: { contentType: 'review' | 'guide'; subject: string; references: ReferenceInput[] }):
  Promise<{ ok: true; notes: ReferenceNote[] } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/content/references', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: data?.error ?? 'Could not read the references.' }
    return { ok: true, notes: (data?.notes ?? []) as ReferenceNote[] }
  } catch {
    return { ok: false, error: 'Could not read the references.' }
  }
}

function shortPath(url: string): string {
  try {
    const u = new URL(url)
    const p = u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : ''
    return p.length > 40 ? `${p.slice(0, 38)}…` : p
  } catch { return '' }
}

type AddMode = 'link' | 'text'

export function ReferencesPanel({ contentType, subject, references, notes, onChange, detected = [] }: Props) {
  const [mode, setMode] = useState<AddMode>('link')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [label, setLabel] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listed = new Set(references.map(referenceKey))
  const offers = detected.map((d) => validUrl(d)).filter((d): d is string => !!d && !listed.has(d))
  const noteFor = (key: string) => notes.find((n) => n.url === key)
  const unfetched = unfetchedReferences(references, notes)
  const full = references.length >= MAX_REFERENCES

  function push(ref: ReferenceInput) {
    if (full) { setError(`Up to ${MAX_REFERENCES} references per piece.`); return false }
    if (listed.has(referenceKey(ref))) { setError('Already on the list.'); return false }
    setError(null)
    onChange([...references, ref], notes)
    return true
  }

  function addLink(raw: string, why = '') {
    const u = validUrl(raw)
    if (!u) { setError('That is not a web address.'); return }
    if (push({ url: u, ...(why.trim() ? { note: why.trim() } : {}) })) { setUrl(''); setNote('') }
  }

  function addText(raw: string, what = '', why = '') {
    const t = raw.trim()
    if (t.length < MIN_REF_TEXT_LEN) { setError(`Paste at least ${MIN_REF_TEXT_LEN} characters of the document.`); return }
    if (push({ text: t, ...(what.trim() ? { label: what.trim() } : {}), ...(why.trim() ? { note: why.trim() } : {}) })) {
      setText(''); setLabel(''); setNote('')
    }
  }

  function addCurrent() {
    if (mode === 'link') addLink(url, note)
    else addText(text, label, note)
  }

  // Leaving the add row with a reference typed but never added used to lose it
  // silently — exactly what happened on the first real guide (2026-11-12). The row's
  // container catches focus leaving it (focusout bubbles); moving between the row's
  // own fields, its Add button or its mode toggle is not leaving the row.
  function leaveAddRow(e: React.FocusEvent<HTMLDivElement>) {
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return
    if (mode === 'link' ? url.trim() : text.trim().length >= MIN_REF_TEXT_LEN) addCurrent()
  }

  function remove(key: string) {
    const refs = references.filter((r) => referenceKey(r) !== key)
    onChange(refs, pruneReferenceNotes(refs, notes))
  }

  function setWhy(key: string, why: string) {
    onChange(references.map((r) => (referenceKey(r) === key ? { ...r, ...(why ? { note: why } : { note: undefined }) } : r)), notes)
  }

  function dropFact(key: string, i: number) {
    onChange(references, notes.map((n) => (n.url === key ? { ...n, facts: n.facts.filter((_, j) => j !== i) } : n)))
  }

  async function readSome(targets: ReferenceInput[]) {
    if (!targets.length || busy) return
    if (!subject.trim()) { setError('Name the product or topic first so the reader knows what to pull.'); return }
    setBusy(true); setError(null)
    const r = await readReferences({ contentType, subject: subject.trim(), references: targets })
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    onChange(references, mergeReferenceNotes(references, notes, r.notes))
  }

  const readAll = () => readSome(unfetched)

  const okCount = notes.filter((n) => n.status === 'ok' && n.facts.length).length
  const factCount = notes.reduce((s, n) => s + (n.status === 'ok' ? n.facts.length : 0), 0)
  const canAdd = mode === 'link' ? !!url.trim() : text.trim().length >= MIN_REF_TEXT_LEN

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-1.5">
        <span className="text-sm font-semibold text-prose">
          References <span className="font-normal text-prose-faint">(optional)</span>
        </span>
        {references.length > 0 && (
          <button
            type="button"
            onClick={readAll}
            disabled={busy || !unfetched.length}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {busy ? 'Reading…' : unfetched.length ? `Read ${unfetched.length}` : okCount ? 'All read' : 'Nothing to read'}
          </button>
        )}
      </div>

      <div className="border border-soft rounded-md divide-y divide-soft">
        {references.map((r) => {
          const key = referenceKey(r)
          const n = noteFor(key)
          const link = r.url
          const retailer = !!link && isRetailerUrl(link)
          const name = link ? (hostOf(link) ?? link) : (r.label?.trim() || 'Pasted text')
          return (
            <div key={key} className="p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-prose truncate">
                    <span className="font-semibold">{name}</span>
                    <span className="text-prose-faint">
                      {link ? shortPath(link) : ` · ${(r.text?.length ?? 0).toLocaleString()} characters`}
                    </span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {retailer
                      ? <Badge tone="warn" size="sm">Retailer</Badge>
                      : !n
                        ? <Badge tone="muted" size="sm">Not read</Badge>
                        : n.status === 'ok'
                          ? <Badge tone={n.facts.length ? 'success' : 'warn'} size="sm">{n.facts.length} {n.facts.length === 1 ? 'fact' : 'facts'}</Badge>
                          : <Badge tone="danger" size="sm">{n.status === 'skipped' ? 'Skipped' : 'Failed'}</Badge>}
                    {link && n?.title && n.status === 'ok' && <span className="text-xs text-prose-muted truncate">{n.title}</span>}
                    {n && !retailer && n.status !== 'skipped' && (
                      <button
                        type="button"
                        onClick={() => readSome([r])}
                        disabled={busy}
                        aria-label={`Read ${name} again`}
                        className="inline-flex items-center min-h-[44px] px-2 -my-2.5 text-xs font-semibold text-prose underline underline-offset-2 disabled:opacity-60"
                      >
                        Re-read
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(key)}
                  aria-label={`Remove ${name}`}
                  className="shrink-0 inline-flex items-center justify-center min-w-[44px] min-h-[44px] -m-2.5 text-prose-muted hover:text-prose"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={r.note ?? ''}
                onChange={(e) => setWhy(key, e.target.value)}
                maxLength={MAX_REF_NOTE_LEN}
                placeholder={link ? 'What do you want from this page? e.g. the weight and battery spec' : 'What do you want from this text? e.g. the dates and the vote counts'}
                aria-label={`What to pull from ${name}`}
                className={fieldClass({ className: 'mt-2' })}
              />
              {retailer && (
                <p className="mt-1.5 text-xs text-prose-muted leading-snug">Retailer pages block readers. Link the product in the product step instead; its specs come from the catalog.</p>
              )}
              {n && n.status !== 'ok' && n.error && !retailer && (
                <p className="mt-1.5 text-xs text-danger-ink leading-snug">{n.error}</p>
              )}
              {n?.status === 'ok' && n.facts.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {n.facts.map((f, i) => (
                    <li key={`${i}-${f.slice(0, 24)}`} className="flex items-start gap-2 text-sm text-prose-muted">
                      <span className="flex-1 leading-snug">{f}</span>
                      <button
                        type="button"
                        onClick={() => dropFact(key, i)}
                        aria-label="Drop this fact"
                        className="shrink-0 inline-flex items-center justify-center min-w-[44px] min-h-[44px] -my-3 -mr-2.5 text-prose-faint hover:text-prose"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}

        <div className="p-3 space-y-2" onBlur={leaveAddRow}>
          <div className="flex items-center gap-1.5" role="group" aria-label="Add a reference as">
            <button
              type="button"
              onClick={() => setMode('link')}
              aria-pressed={mode === 'link'}
              className={buttonVariants({ variant: mode === 'link' ? 'primary' : 'outline', size: 'sm' })}
            >
              Link
            </button>
            <button
              type="button"
              onClick={() => setMode('text')}
              aria-pressed={mode === 'text'}
              className={buttonVariants({ variant: mode === 'text' ? 'primary' : 'outline', size: 'sm' })}
            >
              Paste text
            </button>
            {mode === 'text' && <span className="text-xs text-prose-faint">for a page that can&apos;t be fetched</span>}
          </div>

          {mode === 'link' ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCurrent() } }}
                placeholder="https://…"
                aria-label="Reference link"
                disabled={full}
                className={fieldClass({ className: 'sm:flex-1' })}
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCurrent() } }}
                maxLength={MAX_REF_NOTE_LEN}
                placeholder="What to pull (optional)"
                aria-label="What to pull from the link"
                disabled={full}
                className={fieldClass({ className: 'sm:flex-1' })}
              />
              <button type="button" onClick={addCurrent} disabled={full || !canAdd} className={buttonVariants({ variant: 'outline', size: 'md' })}>
                Add
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={MAX_REF_LABEL_LEN}
                placeholder="What is this? e.g. H.R. 5344 bill text"
                aria-label="What the pasted text is"
                disabled={full}
                className={fieldClass()}
              />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_REF_TEXT_LEN}
                placeholder="Paste the document, or the part of it that matters."
                aria-label="Pasted reference text"
                disabled={full}
                className={fieldClass({ className: 'min-h-[9rem] max-h-[50dvh] overflow-y-auto resize-none [field-sizing:content]' })}
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCurrent() } }}
                    maxLength={MAX_REF_NOTE_LEN}
                  placeholder="What to pull (optional)"
                  aria-label="What to pull from the text"
                  disabled={full}
                  className={fieldClass({ className: 'sm:flex-1' })}
                />
                <button type="button" onClick={addCurrent} disabled={full || !canAdd} className={buttonVariants({ variant: 'outline', size: 'md' })}>
                  Add
                </button>
              </div>
              <p className="text-xs text-prose-faint tabular-nums">
                {text.length.toLocaleString()} / {MAX_REF_TEXT_LEN.toLocaleString()}
                {text.trim().length > 0 && text.trim().length < MIN_REF_TEXT_LEN ? ` · at least ${MIN_REF_TEXT_LEN} characters` : ''}
              </p>
            </div>
          )}

          {offers.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-prose-muted">In your notes:</span>
              {offers.map((o) => (
                <button key={o} type="button" onClick={() => addLink(o)} disabled={full} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  + {hostOf(o) ?? o}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="mt-1.5 text-xs text-prose-muted leading-snug">
        {error
          ? <span className="text-danger-ink font-medium">{error}</span>
          : references.length
            ? `${okCount} of ${references.length} read · ${factCount} reference ${factCount === 1 ? 'fact' : 'facts'} will ride with the brief as attributed knowledge, never as your own experience. Anything still unread is read when you generate.`
            : `Sources the draft may cite: a spec sheet, a recall notice, a study — as a link, or pasted text when the page can't be fetched. Up to ${MAX_REFERENCES}. Facts are attributed to the source, never claimed as yours.`}
      </p>
    </div>
  )
}
