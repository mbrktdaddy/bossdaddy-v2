import ImageLightbox from '@/components/ImageLightbox'
import ProductCtaCard from '@/components/ProductCtaCard'
import CollectionEmbed from '@/components/CollectionEmbed'
import ContentLinkCard from '@/components/ContentLinkCard'
import { splitContentForInlineCards, type InlineProduct } from '@/lib/inline-content'
import { stripAuthoringAttrs } from '@/lib/content/html'
import { stripPlaceholderFigures } from '@/lib/content/publish-gate'
import { lookupImageAssets } from '@/lib/images/assets'
import { BodyFigure, BODY_FIGURE_SIZES } from './BodyFigure'

// THE public body renderer — guides, reviews and collection intros all render
// their stored HTML through this one component, so inline product cards,
// embeds, cross-links and figures behave identically everywhere (before Phase
// 3 the collection page rendered raw HTML and leaked the AI image prompt).
//
// Server component: strips authoring metadata and any stray placeholder, splits
// the HTML into segments, resolves figure facts (size + origin) for figures
// written before mig 166 in ONE query, and renders. Galleries (.bd-image-grid)
// stay raw HTML on purpose — the scroll-snap strip is CSS-driven.

const FIRST_CHILD_RESET = '[&>*:first-child]:mt-0'

interface Props {
  html: string
  /** Products referenced by [[BUY:slug]] anchors (already fetched by the page). */
  products?: InlineProduct[]
  /** The prose wrapper classes for each HTML run — pages keep their own measure/type. */
  proseClassName: string
  productVariant?: 'prominent' | 'final'
  /** `sizes` hint for body figures; defaults to the article measure. */
  figureSizes?: string
  /** Class on the lightbox wrapper. */
  className?: string
}

export default async function ArticleBody({
  html,
  products = [],
  proseClassName,
  productVariant = 'prominent',
  figureSizes = BODY_FIGURE_SIZES,
  className = 'bd-content',
}: Props) {
  const clean = stripPlaceholderFigures(stripAuthoringAttrs(html))
  const segments = splitContentForInlineCards(clean, products)

  // Pages pass `[&>*:first-child]:mt-0` so the body's first block sits flush under
  // the header. Each segment is its own prose wrapper, so applying it to every
  // segment zeroed the top margin of whatever followed a figure/card — the
  // heading after an image hugged it, and the image lost its lead-in space.
  // Only the first segment keeps the reset.
  const tailProseClassName = proseClassName.replace(FIRST_CHILD_RESET, '')
  const proseFor = (i: number) => (i === 0 ? proseClassName : tailProseClassName)

  // Only figures missing a fact need the lookup; fill-time attributes cover the rest.
  const needLookup = segments.flatMap((s) =>
    s.type === 'figure' && !(s.width && s.height && s.origin) ? [s.src] : [],
  )
  const assets = needLookup.length ? await lookupImageAssets(needLookup) : null

  return (
    <ImageLightbox className={className}>
      {segments.map((segment, i) => {
        if (segment.type === 'product') {
          return <ProductCtaCard key={`card-${i}`} product={segment.product} variant={productVariant} />
        }
        if (segment.type === 'collection') {
          return <CollectionEmbed key={`embed-${i}`} slug={segment.slug} />
        }
        if (segment.type === 'contentlink') {
          return <ContentLinkCard key={`link-${i}`} contentType={segment.contentType} slug={segment.slug} />
        }
        if (segment.type === 'figure') {
          return (
            <div key={`figure-${i}`} className={proseFor(i)}>
              <BodyFigure figure={segment} facts={assets?.get(segment.src) ?? null} sizes={figureSizes} />
            </div>
          )
        }
        return segment.content.trim() ? (
          <div key={`html-${i}`} className={proseFor(i)} dangerouslySetInnerHTML={{ __html: segment.content }} />
        ) : null
      })}
    </ImageLightbox>
  )
}
