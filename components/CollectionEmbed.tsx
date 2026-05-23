import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'

interface Props {
  slug: string
}

type CollectionType = 'general' | 'best_of' | 'gift_guide' | 'comparison' | 'stack'

interface ReviewSummary {
  id: string
  slug: string
  title: string
  product_name: string
  rating: number | null
  image_url: string | null
}

interface ItemRow {
  position: number
  role_label: string | null
  wins_category: string | null
  reviews: ReviewSummary | ReviewSummary[] | null
}

interface CollectionRow {
  id: string
  slug: string
  title: string
  description: string | null
  hero_image_url: string | null
  collection_type: string | null
}

const TYPE_META: Record<CollectionType, { eyebrow: string; cta: string; section: string }> = {
  general:    { eyebrow: 'Boss Picks',  cta: 'See the full list →',     section: '/picks' },
  best_of:    { eyebrow: 'Best Of',     cta: 'See the full list →',     section: '/picks' },
  gift_guide: { eyebrow: 'Gift Guide',  cta: 'Open the gift guide →',   section: '/gifts' },
  comparison: { eyebrow: 'Comparison',  cta: 'See the full scorecard →', section: '/comparisons' },
  stack:      { eyebrow: 'The Stack',   cta: 'Build the full stack →',  section: '/stacks' },
}

/**
 * Async server component used inline inside guide article bodies. Triggered by
 * the `<div class="bd-collection-embed" data-collection-slug="...">` marker
 * which is the post-sanitize form of a `[[COLLECTION:slug]]` editor token.
 *
 * Renders a compact preview card: eyebrow + title + description + the first
 * three item tiles + a "See the full X →" link to the appropriate section.
 */
export default async function CollectionEmbed({ slug }: Props) {
  const supabase = await createClient()

  const { data: collection } = await supabase
    .from('collections')
    .select('id, slug, title, description, hero_image_url, collection_type')
    .eq('slug', slug)
    .eq('is_visible', true)
    .single()

  if (!collection) return null
  const c = collection as CollectionRow
  const type = (c.collection_type ?? 'general') as CollectionType
  const meta = TYPE_META[type] ?? TYPE_META.general

  // Pull up to 3 items for the preview
  const { data: rawItems } = await supabase
    .from('collection_items')
    .select('position, role_label, wins_category, reviews(id, slug, title, product_name, rating, image_url)')
    .eq('collection_id', c.id)
    .order('position')
    .limit(3)

  const items = ((rawItems ?? []) as ItemRow[])
    .map((it) => {
      const reviews = it.reviews
      const review = Array.isArray(reviews) ? reviews[0] : reviews
      return { role_label: it.role_label, wins_category: it.wins_category, review }
    })
    .filter((i) => i.review != null)

  const href = `${meta.section}/${c.slug}`

  // For gift guides the URL uses occasion slug, not collection slug. Defer to
  // /gifts index for gift guides embedded in guides — rare edge case.
  const finalHref = type === 'gift_guide' ? '/gifts' : href

  return (
    <aside
      className="not-prose my-8 bg-gradient-to-br from-accent-tint to-white border border-accent-border/40 ring-1 ring-inset ring-stone-900/[0.04] rounded-xl p-5 sm:p-6 shadow-lg shadow-stone-900/[0.06]"
      aria-label={`Featured ${meta.eyebrow}: ${c.title}`}
    >
      <div className="mb-4">
        <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
        <p className="text-[10px] sm:text-xs text-accent-text-soft uppercase tracking-[0.2em] font-black mb-2">
          {meta.eyebrow}
        </p>
        <Link href={finalHref} className="group inline-block">
          <h3 className="text-xl sm:text-2xl font-black text-prose leading-snug group-hover:text-accent-text-soft transition-colors">
            {c.title}
          </h3>
        </Link>
        {c.description && (
          <p className="mt-2 text-sm text-prose-muted leading-relaxed">{c.description}</p>
        )}
      </div>

      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          {items.map(({ role_label, wins_category, review }) => {
            const r = review!
            const badge = role_label || wins_category
            return (
              <li key={r.id}>
                <Link
                  href={`/reviews/${r.slug}`}
                  className="group flex flex-col bg-surface-sunken/60 border border-soft/60 rounded-xl overflow-hidden hover:border-accent-border/40 transition-colors"
                >
                  <div className="relative w-full aspect-square bg-surface">
                    {r.image_url ? (
                      <Image src={r.image_url} alt={r.product_name} fill className="object-cover" sizes="120px" />
                    ) : null}
                    {badge && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-stone-900/85 to-transparent px-1.5 py-1">
                        <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-orange-300 leading-tight line-clamp-1">
                          {badge}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] sm:text-xs font-semibold text-prose group-hover:text-accent-text-soft transition-colors line-clamp-2 leading-tight">
                      {r.product_name}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <Link
        href={finalHref}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-text-soft hover:text-accent transition-colors uppercase tracking-widest"
      >
        {meta.cta}
      </Link>
    </aside>
  )
}
