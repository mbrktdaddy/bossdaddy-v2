'use client'

import { useState } from 'react'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Field } from '@/components/ui/Field'
import { buttonVariants } from '@/components/ui/Button'
import { gapToFact, type Distilled } from '@/lib/content/pipeline/distill'

// The brief step (docs/content-pipeline-plan.md §4a): between the idea step and
// the run. The dump has become clean facts the author edits, the gaps a writer
// would otherwise fill by invention (each answer becomes a fact), and the asides
// that were never facts. "Start the outline" carries the curated list on the
// brief; "Use my notes as written" keeps the raw split. Mobile-first: one column.

/** POST /api/content/distill. null on any failure — a failed distill never blocks drafting. */
export async function distillBrief(brief: Record<string, unknown>): Promise<(Distilled & { skipped: boolean }) | null> {
  try {
    const res = await fetch('/api/content/distill', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief }),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    if (!data || !Array.isArray(data.facts)) return null
    return { facts: data.facts, gaps: data.gaps ?? [], asides: data.asides ?? [], skipped: !!data.skipped }
  } catch {
    return null
  }
}

interface Props {
  distilled: Distilled
  onContinue: (facts: string[]) => void
  onSkip: () => void
  onBack: () => void
}

function parseLines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean)
}

export function BriefReviewPanel({ distilled, onContinue, onSkip, onBack }: Props) {
  const [factsText, setFactsText] = useState(() => distilled.facts.join('\n'))
  const [answers, setAnswers] = useState<string[]>(() => distilled.gaps.map(() => ''))
  const facts = parseLines(factsText)
  const answered = distilled.gaps.map((g, i) => ({ g, a: (answers[i] ?? '').trim() })).filter(({ a }) => a)
  const open = distilled.gaps.length - answered.length

  function start() {
    onContinue([...facts, ...answered.map(({ g, a }) => gapToFact(g.label, a))])
  }

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Your brief</Eyebrow>
        <p className="mt-1 text-sm text-prose-muted">
          Your notes, cleaned into the facts the draft may claim. Fix anything that isn&apos;t what you meant, answer what you can below, and the writer has no reason to invent.
        </p>
      </div>

      <Field
        as="textarea"
        label={`Your facts (${facts.length})`}
        hint="One per line. These are the only firsthand details the draft may claim — add, cut or correct freely."
        rows={Math.max(4, Math.min(14, facts.length + 1))}
        value={factsText}
        onChange={(e) => setFactsText(e.target.value)}
      />

      {distilled.gaps.length > 0 && (
        <div className="space-y-3">
          <div>
            <Eyebrow>Gaps the writer would otherwise fill</Eyebrow>
            <p className="mt-1 text-xs text-prose-muted">Answer what applies. Each answer becomes a fact; leave the rest blank and the draft stays silent on them.</p>
          </div>
          {distilled.gaps.map((g, i) => (
            <Field
              key={`${i}-${g.label}`}
              label={g.question}
              hint={g.why ?? undefined}
              placeholder={`${g.label}…`}
              value={answers[i] ?? ''}
              onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
              maxLength={300}
            />
          ))}
        </div>
      )}

      {distilled.asides.length > 0 && (
        <div className="space-y-1.5">
          <Eyebrow>Noted, not facts</Eyebrow>
          <ul className="text-sm text-prose-muted space-y-1">
            {distilled.asides.map((a, i) => <li key={`${i}-${a.slice(0, 20)}`}>{a}</li>)}
          </ul>
          <p className="text-xs text-prose-faint">Instructions found in your notes. The writer doesn&apos;t see them as facts; set tone and structure in the plan instead.</p>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap pt-2">
        <button type="button" onClick={start} className={buttonVariants()}>
          Start the outline{open ? ` · ${open} ${open === 1 ? 'gap' : 'gaps'} left open` : ''}
        </button>
        <button type="button" onClick={onSkip} className={buttonVariants({ variant: 'outline' })}>
          Use my notes as written
        </button>
        <button type="button" onClick={onBack} className="text-sm text-prose-muted min-h-[44px] px-2">Back</button>
      </div>
    </div>
  )
}
