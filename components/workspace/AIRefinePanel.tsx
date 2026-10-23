'use client'

import { useEffect, useMemo, useState } from 'react'
import { buttonVariants } from '@/components/ui/Button'
import { fieldClass } from '@/components/ui/Field'
import { sectionLabel, splitSections } from '@/lib/content/sections'

// The refine panel: an instruction plus a SCOPE. One section (the default once
// a piece has headings) goes through the patch route and returns only that
// section's prose; "Whole piece" is the old full regeneration, now shown the
// blocks it may overwrite. Either way the workspace stages the result in the
// preview modal — nothing applies until the author accepts.

interface Props {
  title: string
  category: string
  content: string
  productName?: string
  productSlug?: string
  contentType: 'guide' | 'review'
  /** The saved row's id — lets the refine log (generations) point at the piece. */
  contentId?: string
  /** Guides: the persisted inquiry tri-state; null/undefined = pillar default. */
  inquiryMode?: boolean | null
  /** Current structured blocks, so a whole-piece refine edits the real lists. */
  blocks?: {
    pros?: string[]; cons?: string[]; tldr?: string | null
    keyTakeaways?: string[]; bestFor?: string[]; notFor?: string[]
    faqs?: { question: string; answer: string }[]
  }
  onRefined: (draft: RefinedDraft) => void
  onRefinedSection?: (result: { index: number; text: string; warnings: string[] }) => void
  externalInstruction?: string
  onExternalInstructionUsed?: () => void
}

interface RefinedDraft {
  title?: string
  excerpt?: string
  introduction?: string
  sections?: { heading: string; body: string }[]
  conclusion?: string
  verdict?: string
  rating?: number
  pros?: string[]
  cons?: string[]
}

const WHOLE = 'whole'

export function AIRefinePanel({ title, category, content, productName, contentType, contentId, inquiryMode, blocks, onRefined, onRefinedSection, externalInstruction, onExternalInstructionUsed }: Props) {
  const [instruction, setInstruction] = useState(externalInstruction || '')
  const [scope, setScope] = useState<string>(WHOLE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sections = useMemo(() => splitSections(content), [content])
  // A section scope that no longer exists (heading deleted) falls back to whole.
  const scopeIndex = scope === WHOLE ? null : Number(scope)
  const scopeValid = scopeIndex === null || (Number.isInteger(scopeIndex) && !!sections[scopeIndex])

  // When a flag "Fix with AI" button sets an external instruction, adopt it.
  // Adopted during render when the prop changes (no extra effect render); the
  // parent then clears it to '' via onExternalInstructionUsed, so tracking the
  // previous value — '' included — lets the same instruction be sent again.
  const [prevExternal, setPrevExternal] = useState(externalInstruction)
  if (externalInstruction !== prevExternal) {
    setPrevExternal(externalInstruction)
    if (externalInstruction) setInstruction(externalInstruction)
  }
  useEffect(() => {
    if (externalInstruction) onExternalInstructionUsed?.()
  }, [externalInstruction]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefine() {
    if (!instruction.trim()) { setError('Enter refinement instructions first.'); return }
    if (!content) { setError('Generate or write content before refining.'); return }

    setLoading(true)
    setError(null)
    try {
      if (scopeIndex !== null && scopeValid && onRefinedSection) {
        const res = await fetch('/api/content/refine-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentType, contentId, title, category, productName, content, sectionIndex: scopeIndex, instruction, inquiryMode }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Refinement failed')
        onRefinedSection({ index: scopeIndex, text: json.text as string, warnings: (json.warnings as string[]) ?? [] })
      } else {
        const endpoint = contentType === 'guide' ? '/api/claude/guide-refine' : '/api/claude/review-refine'
        const body = contentType === 'guide'
          ? { title, category, content, instruction, contentId, inquiryMode, tldr: blocks?.tldr ?? undefined, keyTakeaways: blocks?.keyTakeaways, faqs: blocks?.faqs }
          : { title, product_name: productName, category, content, instruction, contentId, ...blocks }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Refinement failed')
        onRefined(json.draft as RefinedDraft)
      }
      setInstruction('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed')
    }
    setLoading(false)
  }

  return (
    <div className="bg-surface border border-accent-border/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-accent-text-soft">✨ AI Refine</p>
        <span className="text-xs text-prose-faint">
          {scopeIndex === null ? 'Rewrites the whole piece — slower, costs about a draft' : 'Rewrites one section — keeps everything else'}
        </span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {sections.length > 0 && onRefinedSection && (
          <select
            aria-label="Refine scope"
            value={scopeValid ? scope : WHOLE}
            onChange={(e) => setScope(e.target.value)}
            className={fieldClass({ className: 'sm:w-56 shrink-0' })}
          >
            <option value={WHOLE}>Whole piece</option>
            {sections.map((s) => (
              <option key={s.index} value={String(s.index)}>{sectionLabel(s)}</option>
            ))}
          </select>
        )}
        <input
          id="ai-refine-instruction"
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={scopeIndex === null ? "e.g. 'make it more casual', 'add a section on safety'" : "e.g. 'tighten this', 'add the price comparison', 'cut the joke'"}
          className="flex-1 px-3 py-2 bg-surface-sunken border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover"
          onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleRefine() }}
        />
        <button
          type="button"
          onClick={handleRefine}
          disabled={loading || !instruction.trim()}
          className={buttonVariants({ className: 'shrink-0' })}
        >
          {loading ? 'Refining…' : 'Apply'}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-danger-ink bg-danger-bg border border-danger-line rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
