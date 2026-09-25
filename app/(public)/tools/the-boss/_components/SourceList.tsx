import type { SourceBlock } from '@/lib/boss/types'
import { Eyebrow } from '@/components/ui/Eyebrow'

// Live-search sources under a Boss answer — third-party pages and X posts, built
// from the stream's source data (never parsed from prose). Outbound + nofollow
// ugc: these are someone else's content, not Boss Daddy's. X posts carry an
// explicit "unverified" tag from the DATA, so it shows even if the prose forgets.
export default function SourceList({ items }: { items: SourceBlock[] }) {
  return (
    <div className="border border-soft rounded-xl bg-surface overflow-hidden">
      <Eyebrow className="px-3 pt-2.5 pb-1">Sources</Eyebrow>
      <ul className="divide-y divide-soft">
        {items.map((s) => (
          <li key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="flex min-h-[44px] items-center gap-3 px-3 py-2 text-[13px] hover:bg-surface-hover transition-colors"
            >
              <span className="min-w-0 flex-1 truncate text-prose">{s.title}</span>
              <span className="shrink-0 text-[11px] text-prose-faint">
                {s.origin === 'x' ? 'Post on X · unverified' : s.label}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
