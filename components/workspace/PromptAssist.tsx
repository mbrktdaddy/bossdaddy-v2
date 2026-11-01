'use client'

import { useState } from 'react'
import { buttonVariants } from '@/components/ui/Button'
import { ChevronDownIcon } from '@/components/icons'
import type { AssistMode, AssistPrompt } from '@/lib/images/prompt-assist'

// "Prompt help" under an image-prompt field: ask a photo-editor model to
// rewrite the prompt, give three different takes, suggest one from the piece,
// or describe a photo that already exists. It never edits the field itself —
// `onUse` hands the chosen prompt back and the caller decides where it goes
// (the hero panel sets its prompt state, the media studio its textarea).
//
// Talks to POST /api/images/prompt (the contract is lib/images/prompt-assist.ts).
// A cheap text call: the paid image generation stays behind the caller's own button.

// Mirror AssistInput's limits in lib/images/prompt-assist.ts. Only types come
// from that module, so zod stays out of the client bundle.
const MAX_PROMPT = 700
const MAX_INSTRUCTION = 240
const SLOT_ASPECTS = ['3:2', '1:1', '4:5', '16:10']

// Each chip appends its words to the instruction ("wider, winter").
const CHIPS = [
  { label: 'Wider', text: 'wider' },
  { label: 'Closer', text: 'closer' },
  { label: 'Overhead', text: 'overhead' },
  { label: 'Hands only', text: 'hands only' },
  { label: 'Outdoors', text: 'outdoors' },
  { label: 'Winter', text: 'winter' },
  { label: "Kid's eye level", text: "from a kid's eye level" },
]

interface Props {
  /** The prompt field's current text. */
  value: string
  /** The author chose a result. The caller decides where it goes. */
  onUse: (p: { prompt: string; shot?: string; aspect?: string | null; altText?: string; caption?: string }) => void
  target: 'hero' | 'inline' | 'social'
  people: 'none' | 'anonymous' | 'allowed'
  allowText: boolean
  /** The slot's frame aspect when it has one ('3:2' | '1:1' | '4:5' | '16:10'). */
  aspect?: string
  context?: { title?: string; category?: string; excerpt?: string; heading?: string }
  /** The draft this image belongs to; the server reads it for any context not passed here. */
  source?: { type: 'review' | 'guide'; id: string; afterHeading?: string }
  /** A photo to describe into a prompt. Shows the "Describe photo" button. */
  imageUrl?: string
  disabled?: boolean
  /** Tighter, for narrow panels: drops the quick-change chips and the summary hint. */
  compact?: boolean
}

function clip(text: string | undefined, max: number): string | undefined {
  const t = text?.trim()
  return t ? t.slice(0, max) : undefined
}

// The route can answer with a non-JSON body (a platform timeout page, an
// uncaught error), so read the text first and fall back to something readable
// — the same defensive reader HeroImagePanel uses.
async function readJsonResponse<T extends Record<string, unknown>>(res: Response, fallback: string): Promise<T> {
  const text = await res.text()
  let parsed = {} as T
  try { parsed = text ? JSON.parse(text) as T : ({} as T) } catch { /* non-JSON body */ }
  if (!res.ok) {
    const raw = text && !text.trimStart().startsWith('<') ? text.slice(0, 200) : ''
    throw new Error((parsed as { error?: string }).error ?? (raw || fallback || `HTTP ${res.status}`))
  }
  return parsed
}

function shotLine(r: AssistPrompt): string {
  return r.aspect ? `${r.shot} · ${r.aspect}` : r.shot
}

export function PromptAssist({
  value, onUse, target, people, allowText, aspect, context, source, imageUrl, disabled = false, compact = false,
}: Props) {
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState<AssistMode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<AssistPrompt[] | null>(null)

  const hasPrompt = value.trim().length > 0
  const locked = disabled || busy !== null

  function addChip(text: string) {
    setInstruction((cur) => {
      const t = cur.trim()
      if (!t) return text
      if (t.toLowerCase().includes(text.toLowerCase())) return cur
      return `${t}, ${text}`.slice(0, MAX_INSTRUCTION)
    })
  }

  function requestBody(mode: AssistMode) {
    const current = value.trim().slice(0, MAX_PROMPT)
    return {
      mode,
      // Only rewrite and variations work FROM the current prompt.
      prompt: (mode === 'rewrite' || mode === 'variations') && current ? current : undefined,
      instruction: instruction.trim() || undefined,
      target,
      people,
      allow_text: allowText,
      aspect: aspect && SLOT_ASPECTS.includes(aspect) ? aspect : undefined,
      context: {
        title: clip(context?.title, 150),
        category: clip(context?.category, 80),
        excerpt: clip(context?.excerpt, 300),
        heading: clip(context?.heading, 200),
      },
      source_type: source?.type,
      source_id: source?.id,
      after_heading: clip(source?.afterHeading, 200),
      image_url: mode === 'describe' ? imageUrl : undefined,
    }
  }

  async function run(mode: AssistMode) {
    if (locked) return
    setBusy(mode)
    setError(null)
    setResults(null)
    try {
      const res = await fetch('/api/images/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody(mode)),
      })
      const json = await readJsonResponse<{ prompts?: AssistPrompt[] }>(res, 'Prompt help failed')
      if (!Array.isArray(json.prompts) || json.prompts.length === 0) {
        throw new Error('No suggestions came back — try again.')
      }
      setResults(json.prompts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prompt help failed')
    }
    setBusy(null)
  }

  function use(r: AssistPrompt) {
    onUse({ prompt: r.prompt, shot: r.shot, aspect: r.aspect, altText: r.altText, caption: r.caption })
    setResults(null)
  }

  const outline = buttonVariants({ variant: 'outline', className: 'grow' })

  return (
    <details className="group bg-surface-raised border border-soft rounded-lg">
      <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-3 min-h-[44px] text-sm font-semibold text-prose">
        <span>Prompt help</span>
        <span className="flex items-center gap-2 text-xs font-normal text-prose-faint">
          {!compact && <span>rewrite, vary or suggest</span>}
          <ChevronDownIcon className="w-3 h-3 transition-transform group-open:rotate-180" strokeWidth={2} />
        </span>
      </summary>

      <div className="px-3 pb-3 space-y-3" aria-busy={busy !== null}>
        <input
          type="text"
          value={instruction}
          maxLength={MAX_INSTRUCTION}
          disabled={disabled}
          onChange={(e) => setInstruction(e.target.value.slice(0, MAX_INSTRUCTION))}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            // Enter must not submit an enclosing form; it runs the obvious action.
            e.preventDefault()
            void run(hasPrompt ? 'rewrite' : 'fresh')
          }}
          aria-label="How should the prompt change?"
          placeholder="How should it change? wider, winter, overhead, from a kid's height"
          className="w-full min-h-[44px] px-3 py-2 bg-surface border border-strong rounded-lg text-base sm:text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover disabled:opacity-60"
        />

        {!compact && (
          <div
            role="group"
            aria-label="Quick changes"
            className="flex gap-1.5 overflow-x-auto -mx-3 px-3 scrollbar-hide sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible"
          >
            {CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => addChip(chip.text)}
                disabled={disabled}
                className="shrink-0 inline-flex items-center min-h-[44px] px-3 rounded-md border border-soft bg-surface text-xs font-semibold text-prose-muted hover:text-prose hover:border-strong transition-colors disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => run('rewrite')} disabled={locked || !hasPrompt} className={outline}>
            {busy === 'rewrite' ? 'Working…' : 'Rewrite'}
          </button>
          <button type="button" onClick={() => run('variations')} disabled={locked} className={outline}>
            {busy === 'variations' ? 'Working…' : '3 ideas'}
          </button>
          <button type="button" onClick={() => run('fresh')} disabled={locked} className={outline}>
            {busy === 'fresh' ? 'Working…' : hasPrompt ? 'Fresh' : 'Suggest'}
          </button>
          {imageUrl && (
            <button type="button" onClick={() => run('describe')} disabled={locked} className={outline}>
              {busy === 'describe' ? 'Working…' : 'Describe photo'}
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-danger-ink bg-danger-bg border border-danger-line rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {results && (
          <ul className="space-y-2" aria-label="Suggested prompts">
            {results.map((r, i) => (
              <li key={i} className="bg-surface border border-soft rounded-lg p-3 space-y-2">
                <p className="text-sm text-prose leading-relaxed">{r.prompt}</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] uppercase tracking-widest text-prose-faint">{shotLine(r)}</span>
                  <button type="button" onClick={() => use(r)} className={buttonVariants({ variant: 'primary' })}>
                    Use
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
