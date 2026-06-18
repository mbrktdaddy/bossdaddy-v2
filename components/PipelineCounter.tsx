import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { LABELS } from '@/lib/labels'

interface Props {
  /** Extra classes on the wrapper — lets each surface set its own spacing/bg. */
  className?: string
  align?: 'center' | 'left'
}

// Pipeline transparency line — "N products tested · M on the bench · vote".
// One honest trust signal that proves a real, moving pipeline (real dad, real
// testing). Counts come from the admin client with NO per-user read, so this
// renders fine on statically cached pages (homepage, /vault, author bio).
export default async function PipelineCounter({ className = '', align = 'center' }: Props) {
  const admin = createAdminClient()
  const [{ count: testedRaw }, { count: benchRaw }] = await Promise.all([
    admin
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .eq('is_visible', true),
    admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .in('status', ['testing', 'queued', 'considering']),
  ])

  const tested = testedRaw ?? 0
  const onBench = benchRaw ?? 0
  if (tested === 0 && onBench === 0) return null

  const justify = align === 'center' ? 'justify-center text-center' : 'justify-start text-left'

  return (
    <div className={className}>
      <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-prose-muted ${justify}`}>
        <span>
          <strong className="font-black text-prose tabular-nums">{tested}</strong>{' '}
          {tested === 1 ? 'product' : 'products'} tested
        </span>
        {onBench > 0 && (
          <>
            <span aria-hidden className="text-prose-faint">·</span>
            <span>
              <strong className="font-black text-prose tabular-nums">{onBench}</strong> on the{' '}
              {LABELS.bench.short.toLowerCase()}
            </span>
            <span aria-hidden className="text-prose-faint">·</span>
            <Link
              href="/bench"
              className="font-semibold text-accent hover:text-accent-hover transition-colors"
            >
              vote on the next one →
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
