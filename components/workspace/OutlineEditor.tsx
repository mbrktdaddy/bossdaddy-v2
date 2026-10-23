'use client'

import { useState } from 'react'
import { buttonVariants } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Field } from '@/components/ui/Field'
import type { BlockChoices, Outline, OutlinePart } from '@/lib/content/pipeline/types'

// The author's one real decision point in the staged pipeline: what the piece
// is, part by part, which facts go where, how long, which blocks. Everything
// the sections are written against. Mobile-first: one column, big targets.

interface Props {
  outline: Outline
  contentType: 'review' | 'guide'
  busy: boolean
  onSave: (outline: Outline) => void
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

export function OutlineEditor({ outline, contentType, busy, onSave, onRegenerate, onCancel }: Props) {
  const [draft, setDraft] = useState<Outline>(outline)

  function patchPart(i: number, patch: Partial<OutlinePart>) {
    setDraft((d) => ({ ...d, parts: d.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) }))
  }
  function removePart(i: number) {
    setDraft((d) => ({ ...d, parts: d.parts.filter((_, j) => j !== i) }))
  }
  function addBodyPart(afterIndex: number) {
    setDraft((d) => {
      const parts = [...d.parts]
      parts.splice(afterIndex + 1, 0, { kind: 'body', heading: 'New section', intent: '', notes: [], targetWords: 200, productToken: null })
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
              <TargetWordsField value={p.targetWords} onChange={(targetWords) => patchPart(i, { targetWords })} />
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
        <button type="button" disabled={busy || !valid} onClick={() => onSave(draft)} className={buttonVariants()}>
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
function NotesField({ notes, onChange }: { notes: string[]; onChange: (notes: string[]) => void }) {
  const [text, setText] = useState(() => notes.join('\n'))
  if (parseNotes(text).join('\n') !== canonicalNotes(notes)) setText(notes.join('\n'))
  return (
    <Field
      as="textarea"
      label="Your facts for this part"
      hint="One per line. These are the only firsthand details it may claim."
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
