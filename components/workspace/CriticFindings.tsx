import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Eyebrow } from '@/components/ui/Eyebrow'
import type { Critic, Severity } from '@/lib/content/pipeline/types'

// The editor's findings (rules + model) from the staged pipeline's critic stage.
// Informational: nothing here blocks saving — the author decides.

const TONE: Record<Severity, BadgeTone> = { block: 'danger', warn: 'warn', note: 'info' }
const LABEL: Record<Severity, string> = { block: 'Fix', warn: 'Should fix', note: 'Note' }

interface Props {
  critic: Critic | null
  /** Outline part labels, index-aligned, so a finding can say where it is. */
  partLabels?: string[]
}

export function CriticFindings({ critic, partLabels = [] }: Props) {
  if (!critic) return null
  const { findings, summary } = critic
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Eyebrow className="flex-1">Editor&apos;s read</Eyebrow>
        <span className="text-xs text-prose-faint">
          {findings.length === 0 ? 'No findings' : `${findings.length} finding${findings.length === 1 ? '' : 's'}`}
        </span>
      </div>
      {summary && <p className="text-sm text-prose-muted leading-relaxed">{summary}</p>}
      {findings.length > 0 && (
        <ul className="space-y-2">
          {findings.map((f, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <Badge tone={TONE[f.severity]} size="sm">{LABEL[f.severity]}</Badge>
              <div className="min-w-0 flex-1">
                <p className="text-prose leading-snug">
                  {f.message}
                  {f.part != null && (
                    <span className="text-prose-faint">{' '}· {partLabels[f.part] ?? `part ${f.part + 1}`}</span>
                  )}
                </p>
                {f.quote && <p className="mt-0.5 text-xs text-prose-faint italic truncate">&ldquo;{f.quote}&rdquo;</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
