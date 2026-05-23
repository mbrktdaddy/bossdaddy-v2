interface Props {
  publishedAt?: string | null
  updatedAt?:   string | null
  /** Estimated reading time in minutes — caller computes from word count. */
  readingMinutes?: number | null
  /** Optional byline; defaults to brand voice. */
  author?: string
}

/**
 * Editorial byline + dates + reading time row that sits between the H1 and
 * the article body. Mirrors the trust signals Wirecutter / NYT Strategist
 * surface — readers want to know who wrote it, when, and how long it takes.
 *
 * Renders `Updated DATE` when both dates are present AND they differ —
 * otherwise just `Published DATE`. Keeps the chip count visually tidy on
 * mobile.
 */
export default function EditorialMeta({
  publishedAt,
  updatedAt,
  readingMinutes,
  author = 'Boss Daddy',
}: Props) {
  const dateToShow = pickDisplayDate(publishedAt, updatedAt)
  if (!dateToShow && !readingMinutes && !author) return null

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs text-prose-faint mb-8">
      <span className="inline-flex items-center gap-1.5 font-semibold text-prose-muted">
        <svg className="w-3.5 h-3.5 text-accent-text-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        {author}
      </span>

      {dateToShow && (
        <>
          <span aria-hidden className="text-prose-faint">·</span>
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            {dateToShow.label} {dateToShow.formatted}
          </span>
        </>
      )}

      {readingMinutes != null && readingMinutes > 0 && (
        <>
          <span aria-hidden className="text-prose-faint">·</span>
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {readingMinutes} min read
          </span>
        </>
      )}
    </div>
  )
}

function pickDisplayDate(
  published?: string | null,
  updated?: string | null,
): { label: 'Published' | 'Updated'; formatted: string } | null {
  if (updated && published && updated > published) {
    return { label: 'Updated', formatted: formatDate(updated) }
  }
  const fallback = published ?? updated
  if (!fallback) return null
  return { label: 'Published', formatted: formatDate(fallback) }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day:   'numeric',
      year:  'numeric',
    })
  } catch {
    return iso
  }
}
