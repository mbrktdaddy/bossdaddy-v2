import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { LabelBlock } from '@/components/ui/LabelBlock'
import { buttonVariants } from '@/components/ui/Button'

/**
 * The Creed strip — the About band's sign-off in a column-width form (Phase 3
 * of the Manifesto rollout, 2026-11-13): the closing black moment every
 * detail page lacked. Same anatomy as `AboutBand` (a `data-theme="dark"` zone,
 * the 4px orange rule, the orange label block, the Creed in Fraunces — the
 * one place the serif lives), minus the portrait, plus the two links a reader
 * wants at the end of an article: who wrote this, and how he tests.
 *
 * Placement rule (brand-guide §8 "The close"): never directly above another
 * dark band — the footer, a MerchStrip or a bench head — keep a quiet section
 * between. `links="testing"` is the product-page form (the trust link only).
 */
export default function CreedStrip({
  links = 'both',
  className = '',
}: {
  links?: 'both' | 'testing'
  className?: string
}) {
  return (
    <section
      data-theme="dark"
      aria-label="About the Boss"
      className={`bg-chrome text-prose border-t-4 border-accent rounded-xl px-6 py-8 md:px-8 md:py-10 ${className}`}
    >
      <LabelBlock tone="accent" className="mb-4">About the Boss</LabelBlock>
      <blockquote className="font-editorial-display font-semibold text-prose text-xl md:text-2xl leading-[1.3] tracking-tight max-w-[40ch]">
        {BRAND.creed}
        <span className="block text-accent mt-2">That&rsquo;s {BRAND.positioning}.</span>
      </blockquote>
      <div className="mt-6 flex flex-wrap gap-2.5">
        {links === 'both' && (
          <Link href="/about" className={buttonVariants({ variant: 'primary' })}>
            Meet the Boss
          </Link>
        )}
        <Link href="/how-we-test" className={buttonVariants({ variant: links === 'both' ? 'outline' : 'primary' })}>
          How I test
        </Link>
      </div>
    </section>
  )
}
