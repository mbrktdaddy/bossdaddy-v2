import Link from 'next/link'
import { BRAND } from '@/lib/brand'

/* Homepage brand band — Hard Goods, A2 "folded masthead" (2026-10-14,
   brand-guide §5/§10, mockup docs/mockups/directions/a2-hard-goods-folded.html).

   DESKTOP ONLY. A solid orange band under the black masthead: the tagline in
   uppercase Montserrat black on the left, the in-motion ticker on the right.
   It is the one orange block on the first screen — black masthead, orange
   band, white page — the STIHL / DeWalt stripe.

   On a phone the band is gone: it stacked under the black masthead and read
   as a second header (his one objection to Hard Goods). The tagline folds
   into the masthead as a small orange signature under the wordmark (Header)
   and the topics row (CategoryBar) takes the band's slot. The cover story is
   the first screen.

   Ink on the orange block is the chrome black (#09090b, 4.6:1 on #CC5500).
   The page's prose black misses AA at ticker size, and white-on-orange misses
   it everywhere, so this block is NOT a dark zone — never put white type on
   the core orange at body size. */

interface MotionItem {
  /** Uppercase kicker — the activity verb ("Just tested", "On the bench"). */
  label: string
  /** The subject — product / bench item / guide title. */
  title: string
  href: string
}

/* Recent ACTIVITY (latest tested · next on the bench · newest guide), not
   inventory totals, so the band reads as alive rather than advertising small
   counts. One non-wrapping line of equal segments — long titles truncate.
   Falls back to the independence line when nothing is live. */
function Ticker({ items }: { items: MotionItem[] }) {
  if (items.length === 0) {
    return (
      <p className="min-w-0 truncate text-[13px] font-semibold">
        <span className="font-display font-black uppercase tracking-[0.14em] text-[10px] mr-2">Zero paid placements.</span>
        Every review is earned. Every pick is independently chosen.
      </p>
    )
  }
  return (
    <ul className="flex items-center gap-x-7 min-w-0 flex-1 justify-end text-xs font-semibold">
      {items.map((it) => (
        <li key={it.label} className="min-w-0">
          <Link href={it.href} className="flex items-center gap-2 min-w-0 hover:underline underline-offset-4 decoration-2">
            <span className="shrink-0 font-display font-black text-[10px] uppercase tracking-[0.14em]">{it.label}</span>
            <span className="min-w-0 truncate max-w-[260px]">{it.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

interface Props {
  motion: MotionItem[]
}

export default function HomeHero({ motion }: Props) {
  return (
    <>
      {/* The page's one <h1> on a phone. The band (and its visible h1) is
          display:none below lg, which also removes it from the accessibility
          tree, so this visually-hidden twin carries the heading there; it is
          display:none on lg+ in turn, so only one h1 is ever exposed. */}
      <h1 className="sr-only lg:hidden">{BRAND.tagline}</h1>
      <section aria-label="Boss Daddy" className="hidden lg:block bg-accent text-chrome border-b border-soft">
        <div className="max-w-6xl mx-auto px-6 min-h-[72px] py-3 flex items-center justify-between gap-10">
          {/* Montserrat stays here: the tagline is the wordmark's voice, not a
              content headline. Uppercase is the Hard Goods register. */}
          <h1 className="shrink-0 font-black uppercase text-[26px] leading-none tracking-[-0.01em] whitespace-nowrap">
            {BRAND.tagline}
          </h1>
          <Ticker items={motion} />
        </div>
      </section>
    </>
  )
}
