import Link from 'next/link'
import { BRAND, splitLastWord } from '@/lib/brand'

/* Homepage brand band — light-editorial pass, 2026-10-08.

   This used to be an 80–88vh full-bleed photo poster: tagline, subhead, a
   "Meet the Boss" button, and not one piece of content on the first screen.
   No comparable publication (Wirecutter, Strategist, Gear Patrol, Fatherly)
   leads with a brand poster; they lead with the lead story. So the band is now
   SLIM: kicker · tagline · one-line subhead · a text link to /about · the
   in-motion ticker. On a phone the cover story's image is inside the first
   screen; on desktop the whole cover package is.

   It stays a dark ZONE on purpose — one near-black band under the masthead is
   the black/orange/white punctuation the brand keeps on the white canvas.

   The hero photographs (public/images/hero-workshop*.webp) are no longer
   rendered here. They are kept on disk for /about, which is where "Meet the
   Boss" lands and where a full-bleed portrait earns its space. The homepage
   og:image still points at the desktop crop (see generateMetadata). */

const SUBHEAD =
  'Field-tested gear, no-fluff guides, and free tools for men who show up every day.'

const Arrow = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
)

interface MotionItem {
  /** Uppercase kicker — the activity verb ("Just tested", "On the bench"). */
  label: string
  /** The subject — product / bench item / guide title. */
  title: string
  href: string
}

/* "In Motion" row — DESKTOP ONLY since 2026-10-08: on a phone it stacked into three
   rows under the headline band and read as a second header, while the Latest list
   two scrolls down carries the same recency. Recent ACTIVITY (latest tested · next on the bench · newest
   guide), not inventory totals, so it reads as alive rather than advertising
   small counts. Each item links out. Falls back to the independence line if
   nothing's live yet. */
function Ticker({ items }: { items: MotionItem[] }) {
  return (
    <div className="hidden sm:block border-t border-soft">
      <div className="max-w-6xl mx-auto px-6">
        {items.length === 0 ? (
          <p className="py-4 text-[13px] font-semibold text-prose-muted inline-flex items-center gap-2.5">
            <span className="text-accent" aria-hidden>●</span>
            <span className="font-black text-prose">Zero paid placements.</span>
            Every review is earned. Every pick is independently chosen.
          </p>
        ) : (
          // Desktop only (`hidden sm:block` on the wrapper): one non-wrapping line of
          // equal segments — long titles truncate rather than pushing a second row.
          <ul className="flex items-center gap-x-6 py-4 text-[13px] min-w-0">
            {items.map((it) => (
              <li key={it.label} className="min-w-0 sm:flex-1">
                <Link href={it.href} className="group flex items-center gap-2.5 min-w-0">
                  <span className="text-accent shrink-0" aria-hidden>●</span>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-text">{it.label}</span>
                  <span className="min-w-0 truncate font-semibold text-prose group-hover:text-accent-text-soft transition-colors">{it.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

interface Props {
  motion: MotionItem[]
}

export default function HomeHero({ motion }: Props) {
  const { lead, last } = splitLastWord(BRAND.tagline)
  return (
    <section data-theme="dark" className="bg-chrome border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-7 sm:pt-10 sm:pb-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
          <div className="min-w-0">
            {/* Positioning, not the credibility line — an eyebrow above the H1 is an
                IDENTITY slot (brand-guide §1.7). `positioning` is stored without a
                period so it can sit mid-sentence; standing alone it takes one. */}
            <p className="text-[11px] font-bold text-accent-text uppercase tracking-[0.24em] sm:tracking-[0.28em]">
              {BRAND.positioning}.
            </p>
            {/* The page's one <h1>. Montserrat stays here: the tagline is the
                wordmark's voice, not a content headline. */}
            <h1 className="font-black tracking-tight leading-[0.98] text-prose text-4xl sm:text-5xl md:text-6xl mt-3">
              {lead} <br className="sm:hidden" /><span className="text-accent">{last}</span>
            </h1>
            <p className="text-[15px] sm:text-base text-prose-muted leading-[1.6] mt-3 max-w-xl">
              {SUBHEAD}
            </p>
          </div>
          <Link
            href="/about"
            className="inline-flex items-center gap-2 self-start sm:self-end shrink-0 text-sm font-bold text-prose hover:text-accent-text transition-colors min-h-[44px] sm:min-h-0"
          >
            Meet the Boss
            <Arrow />
          </Link>
        </div>
      </div>
      <Ticker items={motion} />
    </section>
  )
}
