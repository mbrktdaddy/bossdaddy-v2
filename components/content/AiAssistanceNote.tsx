import Link from 'next/link'

// The article-level AI-assistance label the editorial-standards page promises
// ("where AI assistance is substantial, we note it"), driven by
// `generation_method` (mig 164). Sits in the byline meta row; links to the
// policy so the reader can see what "AI-assisted" means here. Nothing renders
// for 'human' or for pieces that predate the column.

const LABELS: Record<string, string> = {
  'ai-drafted':  'AI-assisted draft, human-edited',
  'ai-assisted': 'AI-assisted',
}

interface Props {
  method: string | null | undefined
  className?: string
}

export function aiAssistanceLabel(method: string | null | undefined): string | null {
  return method ? (LABELS[method] ?? null) : null
}

export function AiAssistanceNote({ method, className = '' }: Props) {
  const label = aiAssistanceLabel(method)
  if (!label) return null
  return (
    <Link
      href="/editorial-standards"
      className={`text-prose-muted hover:text-accent-text-soft transition-colors ${className}`}
      title="How we use AI"
    >
      {label}
    </Link>
  )
}
