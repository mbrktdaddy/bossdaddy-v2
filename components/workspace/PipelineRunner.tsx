'use client'

import { useEffect, useRef, useState } from 'react'
import { buttonVariants } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { OutlineEditor } from './OutlineEditor'
import { CriticFindings } from './CriticFindings'
import { DraftProvenanceNote } from './DraftProvenanceNote'
import { partLabel } from '@/lib/content/pipeline/section'
import type { Outline, RunState } from '@/lib/content/pipeline/types'

// Drives the staged pipeline (docs/content-pipeline-plan.md §4) from the
// wizard: create run → outline (author edits) → each part streamed → blocks →
// critic → images → findings → hand the finished run back. Every stage is
// persisted server-side, so a dead tab resumes from the last completed stage.

type Phase = 'boot' | 'resume' | 'creating' | 'outlining' | 'outline' | 'drafting' | 'blocks' | 'critic' | 'images' | 'review' | 'error'

interface Props {
  contentType: 'review' | 'guide'
  /** The wizard's inputs; validated server-side. Null = only resume. */
  brief: Record<string, unknown> | null
  onComplete: (run: RunState) => void
  onCancel: () => void
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const { fieldErrors, formErrors } = (json.details ?? {}) as { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
    const parts = [...(formErrors ?? []), ...Object.entries(fieldErrors ?? {}).map(([k, v]) => `${k}: ${v.join(', ')}`)]
    throw new Error(parts.length ? `${json.error} — ${parts.join('; ')}` : (json.error ?? `Request failed (${res.status})`))
  }
  return json as T
}

export const STAGE_LABEL: Record<RunState['status'], string> = {
  outline: 'planning', drafting: 'writing', blocks: 'summarising', critic: 'editor review', images: 'image plan', done: 'finished', failed: 'failed',
}

export function relTime(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

export function PipelineRunner({ contentType, brief, onComplete, onCancel }: Props) {
  const [run, setRun] = useState<RunState | null>(null)
  const [phase, setPhase] = useState<Phase>('boot')
  const [resumable, setResumable] = useState<RunState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<{ index: number; text: string } | null>(null)
  const [voice, setVoice] = useState<{ hasProfile: boolean; phraseCount: number } | null>(null)
  const booted = useRef(false)

  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : 'Something went wrong')
    setPhase('error')
  }

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    ;(async () => {
      const { run: existing } = await api<{ run: RunState | null }>(`/api/content/runs?type=${contentType}`)
      if (existing) { setResumable(existing); setPhase('resume'); return }
      await startNew()
    })().catch(fail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startNew() {
    if (!brief) throw new Error('Nothing to draft — go back and fill in the brief.')
    setPhase('creating')
    const { run: created, voice: v } = await api<{ run: RunState; voice: { hasProfile: boolean; phraseCount: number } | null }>('/api/content/runs', { method: 'POST', body: JSON.stringify({ brief }) })
    setRun(created)
    setVoice(v ?? null)
    await generateOutline(created)
  }

  async function generateOutline(r: RunState) {
    setPhase('outlining')
    const { run: next } = await api<{ run: RunState }>(`/api/content/runs/${r.id}/outline`, { method: 'POST' })
    setRun(next)
    setPhase('outline')
  }

  async function continueFrom(r: RunState) {
    setRun(r)
    switch (r.status) {
      case 'outline': if (!r.outline) await generateOutline(r); else setPhase('outline'); break
      case 'drafting': await draftAll(r); break
      case 'blocks': await runBlocks(r); break
      case 'critic': await runCritic(r); break
      case 'images': await runImages(r); break
      case 'done': setPhase('review'); break
      default: throw new Error(r.error ?? 'This run failed.')
    }
  }

  async function saveOutline(outline: Outline) {
    if (!run) return
    setPhase('creating')
    const body = { title: outline.title, excerpt: outline.excerpt, parts: outline.parts, blocks: outline.blocks, imageCount: outline.imageCount, elements: outline.elements ?? [] }
    const { run: next } = await api<{ run: RunState }>(`/api/content/runs/${run.id}/outline`, { method: 'PUT', body: JSON.stringify(body) })
    await draftAll(next)
  }

  async function draftAll(r: RunState) {
    setPhase('drafting')
    let cur = r
    setRun(cur)
    const n = cur.outline?.parts.length ?? 0
    for (let i = 0; i < n; i++) {
      if (cur.sections[i]?.text) continue
      cur = await streamSection(cur, i)
    }
    if (cur.status === 'blocks') await runBlocks(cur)
    else if (cur.status === 'drafting') throw new Error(cur.error ?? 'Drafting did not finish — try again.')
    else await continueFrom(cur)
  }

  async function streamSection(r: RunState, index: number): Promise<RunState> {
    setStream({ index, text: '' })
    const res = await fetch(`/api/content/runs/${r.id}/section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index }),
    })
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}))
      throw new Error((j as { error?: string }).error ?? `Part ${index + 1} failed (${res.status})`)
    }
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let text = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      text += dec.decode(value, { stream: true })
      setStream({ index, text })
    }
    const { run: next } = await api<{ run: RunState }>(`/api/content/runs/${r.id}`)
    setStream(null)
    setRun(next)
    if (!next.sections[index]?.text) throw new Error(next.error ?? `Part ${index + 1} didn't save — try again.`)
    return next
  }

  async function runBlocks(r: RunState) {
    setPhase('blocks')
    const { run: next } = await api<{ run: RunState }>(`/api/content/runs/${r.id}/blocks`, { method: 'POST' })
    setRun(next)
    await runCritic(next)
  }

  async function runCritic(r: RunState) {
    setPhase('critic')
    const { run: next } = await api<{ run: RunState }>(`/api/content/runs/${r.id}/critic`, { method: 'POST' })
    setRun(next)
    if (next.status === 'images') await runImages(next)
    else setPhase('review')
  }

  async function runImages(r: RunState) {
    setPhase('images')
    const { run: next } = await api<{ run: RunState }>(`/api/content/runs/${r.id}/images`, { method: 'POST' })
    setRun(next)
    setPhase('review')
  }

  async function retry() {
    setError(null)
    if (!run) return startNew()
    const { run: fresh } = await api<{ run: RunState }>(`/api/content/runs/${run.id}`)
    await continueFrom(fresh)
  }

  async function discardAndRestart(r: RunState | null) {
    setError(null)
    if (r) await api(`/api/content/runs/${r.id}`, { method: 'DELETE' })
    setResumable(null)
    setRun(null)
    await startNew()
  }

  const parts = run?.outline?.parts ?? []
  const labels = parts.map(partLabel)
  const busy = phase === 'creating' || phase === 'outlining' || phase === 'drafting' || phase === 'blocks' || phase === 'critic' || phase === 'images'

  // ── Resume banner ──────────────────────────────────────────────────────────
  if (phase === 'resume' && resumable) {
    return (
      <div className="space-y-4">
        <div className="border border-strong rounded-xl p-5 space-y-3">
          <Eyebrow>Unfinished draft</Eyebrow>
          <p className="text-sm text-prose">
            <span className="font-semibold">{resumable.outline?.title ?? 'Untitled'}</span>
            {' '}— left at the {STAGE_LABEL[resumable.status]} stage, {relTime(resumable.updatedAt)}
            {resumable.costUsd > 0 ? ` · $${resumable.costUsd.toFixed(2)} spent so far` : ''}.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={() => continueFrom(resumable).catch(fail)} className={buttonVariants()}>Resume it</button>
            <button type="button" onClick={() => discardAndRestart(resumable).catch(fail)} className={buttonVariants({ variant: 'outline' })} disabled={!brief}>
              Discard and start over
            </button>
            <button type="button" onClick={onCancel} className="text-sm text-prose-muted">Back</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Outline (the author's decision point) ─────────────────────────────────
  if (phase === 'outline' && run?.outline) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Eyebrow className="flex-1">Plan the piece</Eyebrow>
          {run.costUsd > 0 && <span className="text-xs text-prose-faint">${run.costUsd.toFixed(2)} so far</span>}
        </div>
        {run.error && <p className="text-sm text-warn-ink">{run.error}</p>}
        <DraftProvenanceNote costUsd={null} voice={voice} />
        <OutlineEditor
          key={run.updatedAt}
          outline={run.outline}
          contentType={contentType}
          busy={false}
          onSave={(o) => saveOutline(o).catch(fail)}
          onRegenerate={run.status === 'outline' ? () => generateOutline(run).catch(fail) : undefined}
          onCancel={onCancel}
        />
      </div>
    )
  }

  // ── Finished: the editor's read, then hand back ───────────────────────────
  if (phase === 'review' && run) {
    const blocks = Object.values(run.outline?.blocks ?? {}).filter(Boolean).length
    return (
      <div className="space-y-5">
        <div className="border border-strong rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Eyebrow className="flex-1">Draft finished</Eyebrow>
            <span className="text-xs text-prose-faint">${run.costUsd.toFixed(2)}</span>
          </div>
          <p className="text-sm text-prose-muted">
            {parts.length} parts · {run.sections.reduce((a, s) => a + (s?.text.split(/\s+/).filter(Boolean).length ?? 0), 0)} words · {blocks} blocks · {run.images?.inline.length ?? 0} image placements
          </p>
        </div>
        <div className="border border-soft rounded-xl p-5">
          <CriticFindings critic={run.critic} partLabels={labels} />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => onComplete(run)} className={buttonVariants()}>Continue to preview</button>
          <button type="button" onClick={() => setPhase('outline')} className={buttonVariants({ variant: 'outline' })}>Back to the plan</button>
          <span className="text-xs text-prose-faint">Changing the plan rewrites the prose.</span>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="space-y-4">
        <p className="text-danger-ink text-sm bg-danger-bg border border-danger-line rounded-lg px-4 py-3">{error ?? 'Something went wrong.'}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => retry().catch(fail)} className={buttonVariants()}>Try again</button>
          <button type="button" onClick={() => discardAndRestart(run).catch(fail)} className={buttonVariants({ variant: 'outline' })} disabled={!brief}>Start over</button>
          <button type="button" onClick={onCancel} className="text-sm text-prose-muted">Back</button>
        </div>
      </div>
    )
  }

  // ── Working: progress by part, with the live stream ───────────────────────
  const label =
    phase === 'boot' ? 'Checking for an unfinished draft…'
    : phase === 'creating' ? 'Starting the run…'
    : phase === 'outlining' ? 'Planning the piece…'
    : phase === 'drafting' ? 'Writing…'
    : phase === 'blocks' ? 'Summarising into blocks…'
    : phase === 'critic' ? 'Editor is reading it…'
    : 'Planning images…'

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-soft border-t-accent rounded-full animate-spin shrink-0" />
        <p className="text-prose font-medium flex-1">{label}</p>
        {run && run.costUsd > 0 && <span className="text-xs text-prose-faint">${run.costUsd.toFixed(2)}</span>}
      </div>

      {parts.length > 0 && (
        <ol className="space-y-2">
          {parts.map((p, i) => {
            const done = !!run?.sections[i]?.text
            const live = stream?.index === i
            return (
              <li key={i} className={`border rounded-lg px-4 py-3 ${live ? 'border-accent' : 'border-soft'}`}>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${done ? 'bg-accent' : live ? 'bg-accent animate-pulse' : 'bg-strong'}`} />
                  <span className={done || live ? 'text-prose font-semibold' : 'text-prose-faint'}>{partLabel(p)}</span>
                  <span className="ml-auto text-xs text-prose-faint">{done ? `${run!.sections[i]!.text.split(/\s+/).filter(Boolean).length} w` : `~${p.targetWords} w`}</span>
                </div>
                {live && stream && (
                  <p className="mt-2 text-sm text-prose-muted leading-relaxed whitespace-pre-wrap">{stream.text}<span className="animate-pulse">▍</span></p>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <button type="button" onClick={onCancel} disabled={busy && phase === 'creating'} className="text-sm text-prose-muted">
        Leave — it keeps going server-side and you can resume
      </button>
    </div>
  )
}
