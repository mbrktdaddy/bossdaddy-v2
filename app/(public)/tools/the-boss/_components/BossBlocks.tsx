import type { Block, ProductBlock } from '@/lib/boss/types'
import RecommendationCard from './RecommendationCard'
import GuideCard from './GuideCard'
import { ResearchedList } from './ResearchedList'

// The ONE shared renderer for the Boss's structured attachments — the single
// place that maps the Block union to cards. Grounded content (tested-review pick
// card, first-class guide card) renders in tool-result order; researched picks
// group into the second-class ResearchedList at the end. Future action-tool
// blocks (confirm preview / result card) slot in here with no change to callers.
function dedupe(items: Block[]): Block[] {
  const seen = new Set<string>()
  const out: Block[] = []
  for (const b of items) {
    const key = `${b.kind}:${b.slug}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(b)
  }
  return out
}

export default function BossBlocks({ items, query }: { items: Block[]; query?: string }) {
  if (!items.length) return null
  const unique = dedupe(items)
  const researched = unique.filter((b): b is ProductBlock => b.kind === 'product')
  const grounded = unique.filter((b) => b.kind !== 'product')

  return (
    <div className="mt-2 space-y-2">
      {grounded.map((c) => {
        if (c.kind === 'review') return <RecommendationCard key={`review:${c.slug}`} c={c} />
        if (c.kind === 'guide') return <GuideCard key={`guide:${c.slug}`} c={c} />
        return null
      })}
      {researched.length > 0 && <ResearchedList items={researched} query={query} />}
    </div>
  )
}
