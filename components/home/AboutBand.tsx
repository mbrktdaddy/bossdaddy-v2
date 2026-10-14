import Image from 'next/image'
import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { LabelBlock } from '@/components/ui/LabelBlock'
import { buttonVariants } from '@/components/ui/Button'

/**
 * The About band — the homepage's closing dark moment (Phase 5, 2026-10-08;
 * Hard Goods trim 2026-10-14: 4px orange top rule, orange label block, the
 * two links as buttons). Replaces the text-only Creed section: the portrait
 * that used to be the poster hero sits beside the Creed, with the two links a
 * first-time visitor actually wants from an about block — who is this, and
 * how does he test.
 *
 * The Creed stays in Fraunces: it is the ONE place the serif lives (brand-guide
 * §3, "One voice"). Everything else here is Montserrat / Geist.
 *
 * `object-bottom`: the subject sits low in the portrait crop (the top half of
 * the source is empty wall), so anchoring to the bottom keeps him in frame at
 * every aspect this block takes.
 */
export default function AboutBand() {
  return (
    <section data-theme="dark" className="bg-chrome border-t-4 border-accent border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 py-10 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-8 md:gap-14 items-center">
          <div className="relative aspect-[4/5] md:aspect-[3/4] rounded-2xl overflow-hidden bg-surface-raised">
            <Image
              src="/images/hero-workshop-mobile.webp"
              alt="The Boss at the workbench"
              fill
              sizes="(max-width: 768px) 100vw, 420px"
              className="object-cover object-bottom"
            />
          </div>
          <div>
            <LabelBlock tone="accent" className="mb-5">About the Boss</LabelBlock>
            <blockquote className="font-editorial-display font-semibold text-prose text-2xl md:text-3xl leading-[1.3] tracking-tight">
              {BRAND.creed}
              <span className="block text-accent mt-3">That&rsquo;s {BRAND.positioning}.</span>
            </blockquote>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-prose-faint">— The Boss</p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link href="/about" className={buttonVariants({ variant: 'primary' })}>
                Meet the Boss
              </Link>
              <Link href="/how-we-test" className={buttonVariants({ variant: 'outline' })}>
                How I test
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
