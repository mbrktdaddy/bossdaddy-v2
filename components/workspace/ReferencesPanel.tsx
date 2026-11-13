'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { fieldClass } from '@/components/ui/Field'
import { buttonVariants } from '@/components/ui/Button'
import { XIcon } from '@/components/icons'
import {
  MAX_REFERENCES, MAX_REF_NOTE_LEN, hostOf, isRetailerUrl, pruneReferenceNotes,
  type ReferenceInput, type ReferenceNote,
} from '@/lib/content/references'

// Reference links for a draft (docs/content-pipeline-plan.md §4a). The author
// lists as many links as they like (up to MAX_REFERENCES), each with an optional
// "what I want from it" line, taps Fetch, and reviews the distilled facts per
// link before the run starts. Links pasted into the notes are offered with one
// tap. Retailer links are flagged, not fetched — the product panel owns those.

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

function validUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch { return null }
}

function shortPath(url: string): string {
  try {
    const u = new URL(url)
    const p = u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : ''
    return p.length > 40 ? `${p.slice(0, 38)}…` : p
  } catch { return '' }
}

export function ReferencesPanel({ contentType, subject, references, notes, onChange, detected = [] }: Props) {
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listed = new Set(references.map((r) => r.url))
  const offers = detected.map((d) => validUrl(d)).filter((d): d is string => !!d && !listed.has(d))
  const noteFor = (u: string) => notes.find((n) => n.url === u)
  const unfetched = references.filter((r) => noteFor(r.url)?.status !== 'ok')
  const full = references.length >= MAX_REFERENCES

  function add(raw: string, why = '') {
    const u = validUrl(raw)
    if (!u) { setError('That is not a web address.'); return }
    if (listed.has(u)) { setError('Already on the list.'); return }
    if (full) { setError(`Up to ${MAX_REFERENCES} links per piece.`); return }
    setError(null)
    onChange([...references, { url: u, ...(why.trim() ? { note: why.trim() } : {}) }], notes)
    setUrl(''); setNote('')
  }

  function remove(u: string) {
    const refs = references.filter((r) => r.url !== u)
    onChange(refs, pruneReferenceNotes(refs, notes))
  }

  function setWhy(u: string, why: string) {
    onChange(references.map((r) => (r.url === u ? { ...r, ...(why ? { note: why } : { note: undefined }) } : r)), notes)
  }

  function dropFact(u: string, i: number) {
    onChange(references, notes.map((n) => (n.url === u ? { ...n, facts: n.facts.filter((_, j) => j !== i) } : n)))
  }

  async function fetchAll() {
    if (!unfetched.length || busy) return
    if (!subject.trim()) { setError('Name the product or topic first so the reader knows what to pull.'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/content/references', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType, subject: subject.trim(), references: unfetched }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error ?? 'Could not fetch the links.'); return }
      const fresh = (data?.notes ?? []) as ReferenceNote[]
      const byUrl = new Map(fresh.map((n) => [n.url, n]))
      const merged = [...notes.filter((n) => !byUrl.has(n.url)), ...fresh]
      onChange(references, pruneReferenceNotes(references, merged))
    } catch {
      setError('Could not fetch the links.')
    } finally {
      setBusy(false)
    }
  }

  const okCount = notes.filter((n) => n.status === 'ok' && n.facts.length).length
  const factCount = notes.reduce((s, n) => s + (n.status === 'ok' ? n.facts.length : 0), 0)

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-1.5">
        <span className="text-sm font-semibold text-prose">
          Reference links <span className="font-normal text-prose-faint">(optional)</span>
        </span>
        {references.length > 0 && (
          <button
            type="button"
            onClick={fetchAll}
            disabled={busy || !unfetched.length}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {busy ? 'Reading…' : unfetched.length ? `Fetch ${unfetched.length} ${unfetched.length === 1 ? 'link' : 'links'}` : 'All fetched'}
          </button>
        )}
      </div>

      <div className="border border-soft rounded-md divide-y divide-soft">
        {references.map((r) => {
          const n = noteFor(r.url)
          const retailer = isRetailerUrl(r.url)
          return (
            <div key={r.url} className="p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-prose truncate">
                    <span className="font-semibold">{hostOf(r.url) ?? r.url}</span>
                    <span className="text-prose-faint">{shortPath(r.url)}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {retailer
                      ? <Badge tone="warn" size="sm">Retailer</Badge>
                      : !n
                        ? <Badge tone="muted" size="sm">Not fetched</Badge>
                        : n.status === 'ok'
                          ? <Badge tone="success" size="sm">{n.facts.length} {n.facts.length === 1 ? 'fact' : 'facts'}</Badge>
                          : <Badge tone="danger" size="sm">{n.status === 'skipped' ? 'Skipped' : 'Failed'}</Badge>}
                    {n?.title && n.status === 'ok' && <span className="text-xs text-prose-muted truncate">{n.title}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(r.url)}
                  aria-label={`Remove ${hostOf(r.url) ?? 'link'}`}
                  className="shrink-0 p-2 -m-1 text-prose-muted hover:text-prose"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={r.note ?? ''}
                onChange={(e) => setWhy(r.url, e.target.value)}
                maxLength={MAX_REF_NOTE_LEN}
                placeholder="What do you want from this page? e.g. the weight and battery spec"
                aria-label={`What to pull from ${hostOf(r.url) ?? 'this link'}`}
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
                        onClick={() => dropFact(r.url, i)}
                        aria-label="Drop this fact"
                        className="shrink-0 p-1.5 -m-1 text-prose-faint hover:text-prose"
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

        <div className="p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(url, note) } }}
              placeholder="https://…"
              aria-label="Reference link"
              disabled={full}
              className={fieldClass({ className: 'sm:flex-1' })}
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(url, note) } }}
              maxLength={MAX_REF_NOTE_LEN}
              placeholder="What to pull (optional)"
              aria-label="What to pull from the link"
              disabled={full}
              className={fieldClass({ className: 'sm:flex-1' })}
            />
            <button type="button" onClick={() => add(url, note)} disabled={full || !url.trim()} className={buttonVariants({ variant: 'outline', size: 'md' })}>
              Add
            </button>
          </div>
          {offers.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-prose-muted">In your notes:</span>
              {offers.map((o) => (
                <button key={o} type="button" onClick={() => add(o)} disabled={full} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
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
            ? `${okCount} of ${references.length} read · ${factCount} reference ${factCount === 1 ? 'fact' : 'facts'} will ride with the brief as attributed knowledge, never as your own experience.`
            : `Pages the draft may cite: a spec sheet, a recall notice, a study. Up to ${MAX_REFERENCES}. Fetched facts are attributed to the source, never claimed as yours.`}
      </p>
    </div>
  )
}
