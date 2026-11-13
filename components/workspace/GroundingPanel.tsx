import type { GroundingSummary } from '@/lib/content/pipeline/grounding'
import { isPasteKey, referenceSourceName } from '@/lib/content/references'
import { ChevronDownIcon } from '@/components/icons'

// What a drafted piece was written from — the author's notes and the facts
// fetched from the links they gave — shown read-only in the workspace so the
// editor can check a claim against its source without opening the old run.
// These are the same lines Refine now sees (lib/content/pipeline/grounding.ts).
// Renders nothing for a piece with no run behind it.

export function GroundingPanel({ grounding }: { grounding: GroundingSummary | null }) {
  if (!grounding) return null
  const { facts, references } = grounding

  return (
    <details className="group border border-soft rounded-md">
      {/* display:flex on a <summary> drops the native disclosure marker, so the chevron is it. */}
      <summary className="flex items-center gap-2 min-h-[44px] px-3.5 py-2.5 cursor-pointer select-none text-sm font-semibold text-prose list-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1">
          What this draft was written from
          <span className="ml-2 text-xs font-normal text-prose-muted">
            {facts.length} {facts.length === 1 ? 'note' : 'notes'} · {references.length} {references.length === 1 ? 'source' : 'sources'}
          </span>
        </span>
        <ChevronDownIcon className="w-4 h-4 shrink-0 text-prose-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-3.5 pb-3.5 space-y-4">
        <p className="text-xs text-prose-muted leading-snug">
          Read-only. Your notes are the only firsthand material the draft and Refine may claim; sources are attributed knowledge.
        </p>

        {facts.length > 0 && (
          <div>
            <p className="text-xs text-eyebrow uppercase tracking-widest mb-1.5">Your notes</p>
            <ul className="space-y-1">
              {facts.map((f, i) => (
                <li key={`${i}-${f.slice(0, 24)}`} className="text-sm text-prose-muted leading-snug">{f}</li>
              ))}
            </ul>
          </div>
        )}

        {references.map((r) => (
          <div key={r.url}>
            {isPasteKey(r.url)
              ? <span className="inline-block py-1 text-sm font-semibold text-prose break-words">{referenceSourceName(r)} <span className="font-normal text-prose-faint">(pasted)</span></span>
              : (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block py-1 text-sm font-semibold text-accent-text hover:underline break-words"
                >
                  {referenceSourceName(r)}
                </a>
              )}
            <ul className="space-y-1">
              {r.facts.map((f, i) => (
                <li key={`${i}-${f.slice(0, 24)}`} className="text-sm text-prose-muted leading-snug">{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  )
}
