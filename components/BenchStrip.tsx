import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStatusLabel, type WishlistStatus } from '@/lib/wishlist'
import { getCategoryBySlug } from '@/lib/categories'
import { LABELS } from '@/lib/labels'
import { PhotoIcon } from '@/components/icons'

interface Props {
  heading?: string
  ctaText?: string
  /** One-liner after the heading in the black strip (sm+ only) — defaults to the
   *  canonical bench tagline. Pass null to hide; pass a string to override. */
  subhead?: string | null
  /**
   * Render as a full-width page section (the homepage band). The section and
   * its padding live HERE, not at the call site, because this component
   * returns null at zero items: a caller-owned padded, bordered <section>
   * stayed behind as an empty strip between the orange newsletter block and
   * the black About band whenever the bench was empty (continuity plan B13).
   * A self-suppressing component owns its own wrapper.
   */
  asSection?: boolean
}

const STATUS_RANK: Record<string, number> = { testing: 0, queued: 1 }

/**
 * On the bench — the boxed utility module (Hard Goods, 2026-10-14; brand-guide
 * §6/§10). A 2px black box with a BLACK header strip (live dot · label · link)
 * and SOLID status chips — orange for testing, black for queued. The
 * 2026-10-08 version was a soft card with hairline pills and read as plain on
 * white; the bench is a work surface, so it gets the tool-like treatment.
 * Self-suppresses at zero items.
 */
export default async function BenchStrip({
  heading = 'On the Bench',
  ctaText = "See what's on the bench",
  subhead = LABELS.bench.shortTagline,
  asSection = false,
}: Props) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('products')
    .select('id, slug, title:name, image_url, status, category')
    .in('status', ['testing', 'queued'])
    .order('priority', { ascending: false })
    .limit(20)

  const items = (data ?? [])
    .slice()
    .sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99))
    .slice(0, 3)

  if (items.length === 0) return null

  const strip = (
    <div className="border-2 border-chrome rounded-xl overflow-hidden bg-surface">
      {/* Header strip — a dark ZONE: the pulsing dot is the live-testing signal,
          the label is the module's name, the link is the one action. */}
      <div data-theme="dark" className="bg-chrome text-prose flex items-center gap-2.5 px-4 min-h-[44px]">
        <span aria-hidden className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shadow-[0_0_0_4px_rgba(229,90,26,0.25)]" />
        <span className="font-display font-black text-xs uppercase tracking-[0.16em]">{heading}</span>
        {subhead && (
          <span className="hidden sm:inline min-w-0 truncate text-xs text-prose-faint">· {subhead}</span>
        )}
        <Link
          href="/bench"
          className="ml-auto shrink-0 inline-flex items-center min-h-[44px] font-display font-extrabold text-[11px] uppercase tracking-[0.1em] text-accent-text hover:text-prose transition-colors whitespace-nowrap"
        >
          {ctaText}
        </Link>
      </div>

      {/* Queue rows */}
      <ul className="divide-y divide-soft">
        {items.map((item) => {
          const testing = item.status === 'testing'
          const cat = item.category ? getCategoryBySlug(item.category) : null
          return (
            <li key={item.id}>
              <Link
                href={`/bench/${item.slug}`}
                className="group flex items-center gap-3.5 px-4 py-3 hover:bg-surface-raised transition-colors min-h-[72px]"
              >
                {/* Thumbnail — square, fills */}
                <div className="relative shrink-0 w-14 h-14 rounded-sm overflow-hidden bg-surface-sunken">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt="" /* decorative: the link's text already names it — an alt here gets read twice */
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PhotoIcon className="w-5 h-5 text-prose-faint" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-prose leading-snug line-clamp-2 group-hover:text-accent-text transition-colors">
                    {item.title}
                  </p>
                  {cat && <p className="mt-0.5 text-xs text-prose-faint">{cat.shortLabel}</p>}
                </div>

                {/* Solid status chip — orange = testing now, black = up next.
                    Colour carries the state; the box never changes (brand-guide §2). */}
                <span
                  className={`shrink-0 font-display font-black text-[10px] uppercase tracking-[0.14em] px-2.5 py-1.5 rounded-sm text-white whitespace-nowrap ${
                    testing ? 'bg-accent' : 'bg-chrome'
                  }`}
                >
                  {getStatusLabel(item.status as WishlistStatus)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )

  if (!asSection) return strip
  return (
    <section className="border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">{strip}</div>
    </section>
  )
}
