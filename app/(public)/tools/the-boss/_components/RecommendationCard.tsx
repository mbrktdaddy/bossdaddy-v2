import Link from 'next/link'
import type { ReviewBlock } from '@/lib/boss/types'
import { Card } from '@/components/ui/Card'
import { buttonVariants } from '@/components/ui/Button'

// The rich pick card for a real, hands-on TESTED review (kind 'review') — verdict
// scores + buy link + FTC line. Guides render in GuideCard, researched picks in
// ResearchedList; BossBlocks routes each block kind to its card. Every link comes
// from a real approved review via the tool result, so the UI can never surface an
// unsourced product even if the prose drifts.
export default function RecommendationCard({ c }: { c: ReviewBlock }) {
  const s = c.scores
  return (
    <Card className="p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Link href={c.url} className="font-semibold text-accent hover:underline leading-snug">
          {c.title}
        </Link>
        {typeof c.rating === 'number' && (
          <span className="text-sm font-black text-prose tabular-nums shrink-0">{c.rating.toFixed(1)}</span>
        )}
      </div>

      {s && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-prose-muted">
          <Pill label="Quality" v={s.quality} />
          <Pill label="Value" v={s.value} />
          <Pill label="Ease" v={s.ease} />
          <Pill label="Daily" v={s.dailyUse} />
          {typeof c.specsGrade === 'number' && <Pill label="Specs" v={c.specsGrade} />}
        </div>
      )}

      {c.buyUrl && (
        <div className="mt-3">
          <Link
            href={c.buyUrl}
            rel="sponsored nofollow noopener"
            target="_blank"
            className={buttonVariants()}
          >
            See it <span aria-hidden>→</span>
          </Link>
          <p className="mt-1.5 text-[11px] text-prose-faint">Affiliate link — Boss Daddy may earn a commission at no cost to you.</p>
        </div>
      )}
    </Card>
  )
}

function Pill({ label, v }: { label: string; v: number | null }) {
  if (typeof v !== 'number') return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-soft px-2 py-0.5">
      <span className="text-prose-faint">{label}</span>
      <span className="font-semibold text-prose tabular-nums">{v}</span>
    </span>
  )
}
