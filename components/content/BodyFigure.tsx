import Image from 'next/image'
import { imageCredit } from '@/lib/images/credit'
import { isRenderableImageUrl } from '@/lib/images/remote-hosts'
import type { FigureSegment } from '@/lib/inline-content'
import type { ImageAssetFacts } from '@/lib/images/assets'

// One body figure on a public page (content pipeline Phase 3). Renders through
// next/image when the intrinsic size is known — from the <img> (written at fill
// time since mig 166) or from the media_assets lookup for older figures — so the
// browser reserves the space (no layout shift) and gets a srcset + AVIF/WebP
// instead of the stored 1536px file. The credit line ("AI-generated scene",
// "Photo: Boss Daddy") sits in the figcaption: the brand guide allows one mark
// over an image and a magazine credits a picture under it, not on it.
//
// A figure whose host next/image cannot load (not in next.config remotePatterns)
// or whose size is unknown falls back to a lazy <img> — never a crash, never a
// cropped guess at the ratio.

interface Props {
  figure: FigureSegment
  facts?: ImageAssetFacts | null
  /** The measure the body sits in. */
  sizes?: string
}

export const BODY_FIGURE_SIZES = '(max-width: 768px) 100vw, 680px'

export function BodyFigure({ figure, facts, sizes = BODY_FIGURE_SIZES }: Props) {
  const width = figure.width ?? facts?.width ?? null
  const height = figure.height ?? facts?.height ?? null
  const origin = figure.origin ?? facts?.origin ?? null
  const credit = imageCredit(origin)
  const hasCaption = figure.caption.length > 0
  const optimizable = !!width && !!height && isRenderableImageUrl(figure.src)

  return (
    <figure
      className="bd-image-filled"
      data-slot-id={figure.slotId ?? undefined}
      data-origin={origin ?? undefined}
      data-full={figure.src}
    >
      {optimizable ? (
        <Image
          src={figure.src}
          alt={figure.alt}
          width={width}
          height={height}
          sizes={sizes}
          loading="lazy"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={figure.src} alt={figure.alt} loading="lazy" decoding="async" />
      )}
      {(hasCaption || credit) && (
        <figcaption>
          {figure.caption}
          {credit && (
            <span className="bd-figure-credit" data-sep={hasCaption ? '1' : undefined}>{credit}</span>
          )}
        </figcaption>
      )}
    </figure>
  )
}
