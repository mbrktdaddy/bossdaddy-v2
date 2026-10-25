import Link from 'next/link'

// The ONE page-level AI disclosure the editorial-standards page promises
// ("where AI assistance is substantial, we note it"). Sits in the byline meta
// row and links to the policy. Text assistance comes from `generation_method`
// (mig 164); `hasAiImage` adds the illustration note when the page carries any
// AI-generated image (hero or body) — there are no per-image captions. Nothing
// renders for a human-written piece with no AI imagery.

const METHOD_LABELS: Record<string, string> = {
  'ai-drafted':  'AI-assisted',
  'ai-assisted': 'AI-assisted',
}

interface Props {
  method: string | null | undefined
  hasAiImage?: boolean
  className?: string
}

export function aiAssistanceLabel(
  method: string | null | undefined,
  hasAiImage = false,
): string | null {
  const parts = [
    method ? METHOD_LABELS[method] : undefined,
    hasAiImage ? 'Illustrations AI-generated' : undefined,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export function AiAssistanceNote({ method, hasAiImage = false, className = '' }: Props) {
  const label = aiAssistanceLabel(method, hasAiImage)
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
