import type { Product } from '@/lib/products'
import { getStoreLabel } from '@/lib/products'

type Variant = 'inbody' | 'sidebar' | 'preview'

interface SubScores {
  quality: number | null
  value: number | null
  ease: number | null
  dailyUse: number | null
  /** Optional comparative axis — only rendered when graded. */
  specs?: number | null
}

interface Props {
  variant: Variant
  productName: string
  rating: number
  tldr: string | null
  product?: Pick<
    Product,
    'slug' | 'name' | 'affiliate_url' | 'non_affiliate_url' | 'store' | 'custom_store_name'
  > | null
  wouldRebuy?: boolean | null
  subScores?: SubScores
}

/**
 * 270° arc with the score in the middle. Gap at the bottom.
 * Boss Approved is signaled elsewhere (hero image corner stamp) so the arc
 * stays clean.
 */
function ScoreArc({ rating, size }: { rating: number; size: 'lg' | 'md' }) {
  const safe = Math.max(0, Math.min(10, rating))
  const fillLen = (safe / 10) * 75
  const dim = size === 'lg' ? 'w-32 h-32' : 'w-24 h-24'
  const numCls = size === 'lg' ? 'text-4xl' : 'text-3xl'
  const denomCls = size === 'lg' ? 'text-sm' : 'text-xs'
  const stroke = size === 'lg' ? 8 : 9

  return (
    <div
      className={`relative ${dim} shrink-0`}
      role="img"
      aria-label={`Score ${safe.toFixed(1)} out of 10`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <g transform="rotate(135 50 50)">
          <circle
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke="#CC5500"
            strokeOpacity="0.18"
            strokeWidth={stroke}
            pathLength={100}
            strokeDasharray="75 100"
            strokeLinecap="round"
          />
          <circle
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke="#CC5500"
            strokeWidth={stroke}
            pathLength={100}
            strokeDasharray={`${fillLen} 100`}
            strokeLinecap="round"
          />
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${numCls} font-black leading-none text-prose`}>
          {safe.toFixed(1)}
        </span>
        <span className={`${denomCls} mt-0.5 font-semibold text-accent-text/80`}>/10</span>
      </div>
    </div>
  )
}

function RebuyChip({ rebuy, size = 'md' }: { rebuy: boolean; size?: 'sm' | 'md' }) {
  const padding = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
  if (rebuy) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 font-semibold text-emerald-700 ${padding}`}>
        <span aria-hidden>✓</span>
        I&apos;d buy it again
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 font-semibold text-red-700 ${padding}`}>
      <span aria-hidden>✗</span>
      Wouldn&apos;t buy again
    </span>
  )
}

function SubScoreBars({ scores, size = 'md' }: { scores: SubScores; size?: 'sm' | 'md' }) {
  const entries: { label: string; value: number | null }[] = [
    { label: 'Quality',     value: scores.quality },
    { label: 'Value',       value: scores.value },
    { label: 'Ease of Use', value: scores.ease },
    { label: 'Daily Use',   value: scores.dailyUse },
    // Specs is the comparative axis — only show the row when it's actually graded
    // (legacy reviews keep the familiar 4 bars).
    ...(scores.specs != null ? [{ label: 'Specs', value: scores.specs }] : []),
  ]
  const populated = entries.filter((e) => e.value != null)
  if (populated.length === 0) return null

  const labelCls = size === 'sm' ? 'text-[11px]' : 'text-xs sm:text-sm'
  const scoreCls = size === 'sm' ? 'text-[11px]' : 'text-xs sm:text-sm'
  const barH = size === 'sm' ? 'h-1.5' : 'h-2'
  const rowGap = size === 'sm' ? 'gap-y-2' : 'gap-y-2.5'

  return (
    <ul className={`grid ${rowGap}`}>
      {entries.map(({ label, value }) => {
        const pct = value != null ? (value / 10) * 100 : 0
        const isSet = value != null
        return (
          <li key={label} className="grid grid-cols-[minmax(0,auto)_1fr_minmax(0,auto)] items-center gap-3">
            <span className={`${labelCls} font-medium text-prose-muted`}>{label}</span>
            <div className={`relative w-full overflow-hidden rounded-full bg-surface-raised ${barH}`}>
              <div
                className={`absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-700 ${barH}`}
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
            <span className={`${scoreCls} font-bold tabular-nums ${isSet ? 'text-prose' : 'text-prose-faint'}`}>
              {isSet ? value : '—'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function ProductCtaButton({
  product,
  size = 'md',
}: {
  product: NonNullable<Props['product']>
  size?: 'sm' | 'md'
}) {
  const href = product.affiliate_url ? `/go/${product.slug}` : product.non_affiliate_url
  if (!href) return null

  const isAffiliate = Boolean(product.affiliate_url)
  const isAmazon = isAffiliate && product.store === 'amazon'
  const rel = isAffiliate ? 'sponsored nofollow noopener' : 'noopener'
  const storeName = getStoreLabel(product.store, product.custom_store_name)
  const label = isAffiliate ? `Check Price at ${storeName}` : `View ${product.name}`
  const padding = size === 'sm' ? 'px-4 py-2.5 text-sm' : 'px-5 py-3 text-base'

  return (
    <div className="mt-1 w-full">
      <a
        href={href}
        target="_blank"
        rel={rel}
        data-product-slug={product.slug}
        className={`inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-accent font-bold text-white transition-colors hover:bg-accent-hover ${padding}`}
      >
        {label}
        <span aria-hidden>→</span>
      </a>
      {isAmazon && (
        <p className="mt-2 text-[11px] text-prose-faint">
          As an Amazon Associate I earn from qualifying purchases.
        </p>
      )}
    </div>
  )
}

export default function VerdictCard({
  variant,
  productName,
  rating,
  tldr,
  product,
  wouldRebuy,
  subScores,
}: Props) {
  const hasRebuy = typeof wouldRebuy === 'boolean'
  const hasSubScores = !!subScores && (
    subScores.quality != null ||
    subScores.value != null ||
    subScores.ease != null ||
    subScores.dailyUse != null ||
    subScores.specs != null
  )

  // ── Sidebar variant — sticky on XL, narrow column ──────────────────────────
  if (variant === 'sidebar') {
    return (
      <section
        className="rounded-xl border border-soft bg-surface p-5"
        aria-label="Quick verdict"
      >
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-accent">Quick Verdict</p>
        <p className="mt-1 mb-4 text-xs font-black uppercase tracking-wide text-prose/90 line-clamp-2">{productName}</p>

        <div className="flex flex-col items-center gap-3">
          <ScoreArc rating={rating} size="md" />
          {hasRebuy && <RebuyChip rebuy={wouldRebuy!} size="sm" />}
        </div>

        {tldr && (
          <p className="mt-4 line-clamp-3 text-xs leading-relaxed text-prose-muted">{tldr}</p>
        )}

        {hasSubScores && (
          <div className="mt-4 border-t border-soft/60 pt-4">
            <SubScoreBars scores={subScores!} size="sm" />
          </div>
        )}

        {product && (
          <div className="mt-4">
            <ProductCtaButton product={product} size="sm" />
          </div>
        )}
      </section>
    )
  }

  // ── Preview variant — workspace draft preview ──────────────────────────────
  if (variant === 'preview') {
    return (
      <section
        className="rounded-xl border border-soft bg-surface p-4"
        aria-label="Verdict preview"
      >
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-accent">The Verdict</p>
        <p className="mt-0.5 mb-4 text-xs font-black uppercase tracking-wide text-prose/90 line-clamp-1">
          {productName || <span className="text-prose-faint italic normal-case font-normal">no product name</span>}
        </p>

        <div className="flex flex-col items-center gap-3">
          <ScoreArc rating={rating} size="md" />
          {hasRebuy && <RebuyChip rebuy={wouldRebuy!} size="sm" />}
        </div>

        {tldr && (
          <p className="mt-4 text-xs leading-relaxed text-prose">{tldr}</p>
        )}

        {hasSubScores && (
          <div className="mt-4 border-t border-soft/60 pt-3">
            <SubScoreBars scores={subScores!} size="sm" />
          </div>
        )}
      </section>
    )
  }

  // ── In-body variant — primary mobile/desktop placement on the public page ──
  return (
    <section
      className="mb-8 rounded-xl border border-soft bg-surface p-5 sm:p-6"
      aria-label="The verdict"
    >
      {/* Header — section label + product name. Label is a real <h2> so
          search/AI overviews can extract the verdict as the summary section
          (in-body is the primary, always-rendered placement; the sidebar
          "Quick Verdict" stays a <p> to avoid a duplicate heading). */}
      <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-accent">The Verdict</h2>
      <p className="mt-1 mb-5 text-sm font-black uppercase tracking-wide text-prose/90 sm:text-base">{productName}</p>

      {/* Conclusion cluster — arc (with approved check baked in) + rebuy chip */}
      <div className="flex flex-wrap items-center justify-center gap-5 sm:flex-nowrap sm:justify-start sm:gap-6">
        <ScoreArc rating={rating} size="lg" />
        {hasRebuy && (
          <div className="flex justify-center sm:justify-start">
            <RebuyChip rebuy={wouldRebuy!} />
          </div>
        )}
      </div>

      {tldr && (
        <p className="mt-5 text-base leading-relaxed text-prose sm:text-lg">
          {tldr}
        </p>
      )}

      {hasSubScores && (
        <div className="mt-5 border-t border-soft/60 pt-4">
          <SubScoreBars scores={subScores!} />
        </div>
      )}

      {product && (
        <div className="mt-5 border-t border-soft/60 pt-4">
          <ProductCtaButton product={product} size="md" />
        </div>
      )}
    </section>
  )
}
