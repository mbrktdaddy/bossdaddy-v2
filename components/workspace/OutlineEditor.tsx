'use client'

import { useState } from 'react'
import { buttonVariants } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Field } from '@/components/ui/Field'
import type { BlockChoices, Outline, OutlinePart, PartFormat } from '@/lib/content/pipeline/types'
import { ELEMENT_LABEL } from '@/lib/content/elements'
import { hostOf, type ReferenceNote } from '@/lib/content/references'
import type { ResearchFinding, ResearchResult } from '@/lib/content/pipeline/research'

// The author's one real decision point in the staged pipeline: what the piece
// is, part by part, which facts go where, how long, which blocks. Everything
// the sections are written against. Mobile-first: one column, big targets.

interface Props {
  outline: Outline
  contentType: 'review' | 'guide'
  busy: boolean
  /** `addReferenceNotes`: sources kept from "Research this part", to join the brief with this save. */
  onSave: (outline: Outline, addReferenceNotes: ReferenceNote[]) => void
  /** One live web search for a part's missing facts; absent = no button. */
  onResearch?: (partIndex: number) => Promise<ResearchResult>
  /** Only offered before the first "Start writing" (the server regenerates from the brief). */
  onRegenerate?: () => void
  onCancel: () => void
}

const BLOCK_LABELS: Record<keyof BlockChoices, { label: string; reviewOnly: boolean }> = {
  tldr:         { label: 'TL;DR', reviewOnly: false },
  keyTakeaways: { label: 'Key takeaways', reviewOnly: false },
  faqs:         { label: 'FAQs', reviewOnly: false },
  bestFor:      { label: 'Best for', reviewOnly: true },
  notFor:       { label: 'Not for', reviewOnly: true },
  prosCons:     { label: 'Pros & cons', reviewOnly: true },
  subScores:    { label: 'Sub-scores (suggested, you confirm)', reviewOnly: true },
}

export function OutlineEditor({ outline, contentType, busy, onSave, onRegenerate, onCancel, onResearch }: Props) {
  const [draft, setDraft] = useState<Outline>(outline)
  // The sources field shows on every part once any part cites one, so a fact can be moved between parts.
  const hasRefs = draft.parts.some((p) => (p.refs?.length ?? 0) > 0)

  // "Research this part": one search per tap, the author keeps what belongs; kept
  // facts become the part's ref lines, their sources ride to the brief on save.
  type ResearchState = { busy: boolean; error: string | null; findings: ResearchFinding[] | null; notes: ReferenceNote[]; picked: number[] }
  const idle: ResearchState = { busy: false, error: null, findings: null, notes: [], picked: [] }
  const [research, setResearch] = useState<Record<number, ResearchState>>({})
  const [pendingNotes, setPendingNotes] = useState<ReferenceNote[]>([])
  async function runResearch(i: number) {
    if (!onResearch) return
    setResearch((r) => ({ ...r, [i]: { ...idle, busy: true } }))
    try {
      const res = await onResearch(i)
      setResearch((r) => ({ ...r, [i]: { ...idle, findings: res.findings, notes: res.notes, picked: res.findings.map((_, j) => j) } }))
    } catch (e) {
      setResearch((r) => ({ ...r, [i]: { ...idle, error: e instanceof Error ? e.message : 'Research failed.' } }))
    }
  }
  function togglePick(i: number, j: number) {
    setResearch((r) => { const st = r[i]; if (!st) return r; const picked = st.picked.includes(j) ? st.picked.filter((x) => x !== j) : [...st.picked, j]; return { ...r, [i]: { ...st, picked } } })
  }
  function addPicked(i: number) {
    const st = research[i]
    if (!st?.findings) return
    const chosen = st.picked.map((j) => st.findings![j]).filter(Boolean)
    const lines = chosen.map((f) => f.line)
    setDraft((d) => ({ ...d, parts: d.parts.map((p, k) => (k === i ? { ...p, refs: [...(p.refs ?? []), ...lines.filter((l) => !(p.refs ?? []).includes(l))] } : p)) }))
    // Only the sources behind the kept facts join the brief, with only those facts.
    const kept = st.notes
      .map((n) => ({ ...n, facts: n.facts.filter((f) => chosen.some((c) => c.fact === f && c.source.url === n.url)) }))
      .filter((n) => n.facts.length)
    setPendingNotes((prev) => {
      const byUrl = new Map(prev.map((n) => [n.url, n]))
      for (const n of kept) { const p = byUrl.get(n.url); byUrl.set(n.url, p ? { ...p, facts: [...new Set([...p.facts, ...n.facts])] } : n) }
      return [...byUrl.values()]
    })
    setResearch((r) => ({ ...r, [i]: idle }))
  }
  const dismissResearch = (i: number) => setResearch((r) => ({ ...r, [i]: idle }))

  function patchPart(i: number, patch: Partial<OutlinePart>) {
    setDraft((d) => ({ ...d, parts: d.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) }))
  }
  function removePart(i: number) {
    setDraft((d) => ({ ...d, parts: d.parts.filter((_, j) => j !== i) }))
  }
  function addBodyPart(afterIndex: number) {
    setDraft((d) => {
      const parts = [...d.parts]
      parts.splice(afterIndex + 1, 0, { kind: 'body', heading: 'New section', intent: '', notes: [], refs: [], targetWords: 200, productToken: null })
      return { ...d, parts }
    })
  }
  function movePart(i: number, dir: -1 | 1) {
    setDraft((d) => {
      const j = i + dir
      if (j <= 0 || j >= d.parts.length - 1) return d // intro stays first, closing stays last
      const parts = [...d.parts]
      ;[parts[i], parts[j]] = [parts[j], parts[i]]
      return { ...d, parts }
    })
  }

  const totalWords = draft.parts.reduce((a, p) => a + (p.targetWords || 0), 0)
  const valid = draft.title.trim().length > 0 && draft.parts.every((p) => p.intent.trim().length > 0 && (p.kind === 'intro' || p.heading.trim().length > 0))

  return (
    <div className="space-y-6">
      {draft.duplicateWarning && (
        <p className="text-sm text-warn-ink border border-strong rounded-lg px-4 py-3">{draft.duplicateWarning}</p>
      )}

      <div className="space-y-3">
        <Eyebrow>Title</Eyebrow>
        {draft.titleOptions.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {draft.titleOptions.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, title: t }))}
                className={buttonVariants({ variant: draft.title === t ? 'primary' : 'outline', size: 'sm' })}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <Field label="Title" hideLabel value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} maxLength={120} />
        <Field as="textarea" label="Excerpt" hint="One card sentence, under 160 characters" rows={2} value={draft.excerpt} onChange={(e) => setDraft((d) => ({ ...d, excerpt: e.target.value }))} maxLength={200} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Eyebrow className="flex-1">Parts</Eyebrow>
          <span className="text-xs text-prose-faint">~{totalWords} words</span>
        </div>
        <ol className="space-y-3">
          {draft.parts.map((p, i) => (
            <li key={i} className="border border-soft rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-prose-faint uppercase tracking-widest">
                  {p.kind === 'intro' ? 'Intro' : p.kind === 'closing' ? 'Closing' : `Section ${i}`}
                </span>
                {p.productToken && <span className="text-xs text-prose-faint">· link: {p.productToken}</span>}
                <span className="flex-1" />
                {p.kind === 'body' && (
                  <>
                    <button type="button" onClick={() => movePart(i, -1)} className="text-xs text-prose-muted px-2 py-1" aria-label="Move up">↑</button>
                    <button type="button" onClick={() => movePart(i, 1)} className="text-xs text-prose-muted px-2 py-1" aria-label="Move down">↓</button>
                    <button type="button" onClick={() => removePart(i)} className="text-xs text-danger-ink px-2 py-1">Remove</button>
                  </>
                )}
              </div>
              {p.kind !== 'intro' && (
                <Field label="Heading" hideLabel placeholder="Heading" value={p.heading} onChange={(e) => patchPart(i, { heading: e.target.value })} maxLength={200} />
              )}
              <Field as="textarea" label="What this part must do" rows={2} value={p.intent} onChange={(e) => patchPart(i, { intent: e.target.value })} maxLength={400} />
              <NotesField notes={p.notes} onChange={(notes) => patchPart(i, { notes })} />
              {hasRefs && (
                <NotesField
                  notes={p.refs ?? []}
                  onChange={(refs) => patchPart(i, { refs })}
                  label="Sources this part cites"
                  hint="One per line, as fact (source: name). Attributed knowledge the writer names in words — never claimed as yours."
                />
              )}
              {p.kind === 'body' && onResearch && (
                <div className="space-y-2">
                  {!research[i]?.findings && (
                    <button
                      type="button"
                      disabled={busy || !!research[i]?.busy}
                      onClick={() => runResearch(i)}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      {research[i]?.busy ? 'Searching the web…' : 'Research this part'}
                    </button>
                  )}
                  {research[i]?.error && <p className="text-xs text-danger-ink leading-snug">{research[i].error}</p>}
                  {research[i]?.findings && (
                    <div className="border border-soft rounded-lg p-3 space-y-2">
                      <p className="text-xs text-eyebrow uppercase tracking-widest">Found on the web — keep what belongs here</p>
                      {research[i].findings!.length === 0 && <p className="text-sm text-prose-muted">Nothing solid turned up.</p>}
                      <ul className="space-y-1">
                        {research[i].findings!.map((f, j) => (
                          <li key={`${f.source.url}:${j}`}>
                            <label className="flex items-start gap-3 min-h-[44px] py-1 cursor-pointer">
                              <input type="checkbox" className="mt-1" checked={research[i].picked.includes(j)} onChange={() => togglePick(i, j)} />
                              <span className="text-sm text-prose leading-snug">{f.fact} <span className="text-prose-faint">— {f.source.title || hostOf(f.source.url) || f.source.url}</span></span>
                            </label>
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center gap-3 flex-wrap">
                        {research[i].findings!.length > 0 && (
                          <button type="button" disabled={!research[i].picked.length} onClick={() => addPicked(i)} className={buttonVariants({ size: 'sm' })}>
                            Add {research[i].picked.length} to this part
                          </button>
                        )}
                        <button type="button" onClick={() => dismissResearch(i)} className="text-xs text-prose-muted min-h-[44px] px-2">Dismiss</button>
                      </div>
                      <p className="text-xs text-prose-faint">Kept facts are cited as their source says, never as yours; the source joins your references.</p>
                    </div>
                  )}
                </div>
              )}
              <TargetWordsField value={p.targetWords} onChange={(targetWords) => patchPart(i, { targetWords })} />
              {p.kind === 'body' && (
                <FormatField value={p.format ?? 'prose'} onChange={(format) => patchPart(i, { format })} />
              )}
              {p.kind !== 'closing' && (
                <button type="button" onClick={() => addBodyPart(i)} className="text-xs text-prose-muted underline">+ add a section after this</button>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-3">
        <Eyebrow>Blocks this piece gets</Eyebrow>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(BLOCK_LABELS) as (keyof BlockChoices)[])
            .filter((k) => contentType === 'review' || !BLOCK_LABELS[k].reviewOnly)
            .map((k) => (
              <label key={k} className="flex items-center gap-3 border border-soft rounded-lg px-3 py-2.5 cursor-pointer">
                <input type="checkbox" checked={draft.blocks[k]} onChange={(e) => setDraft((d) => ({ ...d, blocks: { ...d.blocks, [k]: e.target.checked } }))} />
                <span className="text-sm text-prose">{BLOCK_LABELS[k].label}</span>
              </label>
            ))}
        </div>
        <Field
          label="Inline images to plan"
          type="number"
          inputMode="numeric"
          min={0}
          max={6}
          value={draft.imageCount}
          onChange={(e) => setDraft((d) => ({ ...d, imageCount: Math.max(0, Math.min(6, parseInt(e.target.value || '0', 10) || 0)) }))}
        />
      </div>

      {(draft.elements?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <Eyebrow>Body elements the planner recommends</Eyebrow>
          <ul className="space-y-2">
            {draft.elements!.map((el, i) => (
              <li key={`${el.type}:${el.afterHeading}:${i}`} className="flex items-start gap-3 border border-soft rounded-lg px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-prose">
                    <span className="font-semibold uppercase tracking-wider text-xs">{ELEMENT_LABEL[el.type]}</span>
                    <span className="text-prose-faint"> · {el.afterHeading ? `after "${el.afterHeading}"` : 'after the intro'}</span>
                  </p>
                  <p className="text-xs text-prose-muted">{el.reason}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, elements: (d.elements ?? []).filter((_, j) => j !== i) }))}
                  className="min-h-[44px] px-2 text-xs text-danger-ink"
                >
                  Drop
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-prose-faint">Each is drafted from the finished prose and lands in the body, where you can edit or delete it.</p>
        </div>
      )}

      {draft.related.length > 0 && (
        <div className="space-y-2">
          <Eyebrow>Already on the site</Eyebrow>
          <ul className="text-sm text-prose-muted space-y-1">
            {draft.related.map((r) => (
              <li key={`${r.type}:${r.slug}`}>
                <span className="text-xs uppercase tracking-widest text-prose-faint mr-2">{r.type}</span>
                {r.title}
              </li>
            ))}
          </ul>
          <p className="text-xs text-prose-faint">The writer sees these too and will complement rather than repeat them.</p>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap pt-2">
        <button type="button" disabled={busy || !valid} onClick={() => onSave(draft, pendingNotes)} className={buttonVariants()}>
          {busy ? 'Working…' : 'Start writing'}
        </button>
        {onRegenerate && (
          <button type="button" disabled={busy} onClick={onRegenerate} className={buttonVariants({ variant: 'outline' })}>
            Re-plan
          </button>
        )}
        <button type="button" disabled={busy} onClick={onCancel} className="text-sm text-prose-muted">Back</button>
      </div>
    </div>
  )
}

const MIN_WORDS = 40
const MAX_WORDS = 600

/** One fact per line → the trimmed, non-empty list the outline stores. */
function parseNotes(text: string): string[] {
  return text.split('\n').map((n) => n.trim()).filter(Boolean)
}

/** The comparable form of a notes list: what it would parse to as text. */
function canonicalNotes(notes: string[]): string {
  return parseNotes(notes.join('\n')).join('\n')
}

/**
 * The facts textarea. It owns the raw text; the outline gets the parsed list on
 * every keystroke (so Start writing always sees current facts) but the field
 * never re-renders FROM that list while you type — otherwise the trim/filter
 * would eat the space you just typed and the blank line Enter just made. It
 * adopts the list only when it changed from outside (a part moved or removed,
 * where the key is the array index), and tidies itself on blur.
 *
 * BOTH sides of the sync check are canonicalised on purpose. The model's notes
 * arrive untrimmed (`buildOutline` passes them through verbatim — " fact ", ""),
 * and comparing parsed text against the RAW list would never match, so the
 * render-time setText would fire forever ("Too many re-renders").
 */
function NotesField({
  notes, onChange,
  label = 'Your facts for this part',
  hint = 'One per line. These are the only firsthand details it may claim.',
}: { notes: string[]; onChange: (notes: string[]) => void; label?: string; hint?: string }) {
  const [text, setText] = useState(() => notes.join('\n'))
  if (parseNotes(text).join('\n') !== canonicalNotes(notes)) setText(notes.join('\n'))
  return (
    <Field
      as="textarea"
      label={label}
      hint={hint}
      rows={Math.max(2, Math.min(5, text.split('\n').length + 1))}
      value={text}
      onChange={(e) => { setText(e.target.value); onChange(parseNotes(e.target.value)) }}
      onBlur={() => setText(notes.join('\n'))}
    />
  )
}

function clampWords(n: number): number {
  return Math.max(MIN_WORDS, Math.min(MAX_WORDS, n))
}

/**
 * Target words. The old field clamped on every keystroke, so clearing it jumped
 * to 40 and typing "200" became "2" → 40 → "402". This keeps the typed digits
 * and settles on blur: an in-range number is adopted as you type (so the
 * running total stays live), an out-of-range one is clamped when you leave,
 * and an empty field restores the value you started from — clearing it and
 * tapping away changes nothing.
 */
const FORMAT_OPTIONS: { value: PartFormat; label: string; hint: string }[] = [
  { value: 'prose', label: 'Prose',  hint: 'paragraphs' },
  { value: 'steps', label: 'Steps',  hint: 'one numbered list' },
  { value: 'list',  label: 'List',   hint: 'one bulleted list' },
]

/** The shape of the part's prose — recommended by the outline stage, decided here. */
function FormatField({ value, onChange }: { value: PartFormat; onChange: (f: PartFormat) => void }) {
  return (
    <div role="radiogroup" aria-label="Format" className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-prose-faint">Format</span>
      {FORMAT_OPTIONS.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={`min-h-[44px] px-3 text-xs font-semibold uppercase tracking-wider border transition-colors ${
              active ? 'border-prose bg-prose text-surface' : 'border-soft bg-surface text-prose-muted hover:border-strong'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function TargetWordsField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(() => String(value))
  // The last value this field and the outline agreed on. Differs from `value`
  // only when a part was moved or removed under it (key = index) — adopt it.
  const [seen, setSeen] = useState(value)
  if (value !== seen) { setSeen(value); setText(String(value)) }
  return (
    <Field
      label="Target words"
      type="number"
      inputMode="numeric"
      min={MIN_WORDS}
      max={MAX_WORDS}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseInt(e.target.value, 10)
        if (!Number.isNaN(n) && n >= MIN_WORDS && n <= MAX_WORDS) { setSeen(n); onChange(n) }
      }}
      onBlur={() => {
        const typed = parseInt(text, 10)
        const n = Number.isNaN(typed) ? seen : clampWords(typed)
        setText(String(n))
        if (n !== seen) { setSeen(n); onChange(n) }
      }}
    />
  )
}
