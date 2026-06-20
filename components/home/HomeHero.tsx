import Image from 'next/image'
import Link from 'next/link'

/* Homepage Photo hero — dark-first makeover (docs/dark-makeover-rollout-plan.md).
   DESKTOP: wide workshop shot, subject right, manifesto in the dark-left column.
   MOBILE: portrait shot, subject low — copy SPLIT (title top / subhead + CTAs
   bottom) so it never overlaps the subject. Two gradient washes per breakpoint
   guarantee white-text legibility. Accent = Hot orange (global dark token). */

const MANIFESTO = ['Real Dads.', 'Smart Tools.', 'Better Decisions.']
const SUBHEAD =
  'Honest reviews, practical guides, and a growing set of tools — built by a dad in the trenches.'
const PROOF = 'Zero sponsors. Zero fluff.'

function Manifesto({ className = '' }: { className?: string }) {
  return (
    <h1 className={`font-black tracking-tight leading-[1.02] ${className}`}>
      {MANIFESTO.map((line, i) => (
        <span key={line} className={`block ${i === MANIFESTO.length - 1 ? 'text-accent' : 'text-prose'}`}>
          {line}
        </span>
      ))}
    </h1>
  )
}

const Arrow = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
)

export default function HomeHero() {
  return (
    <section className="relative min-h-[88vh] overflow-hidden border-b border-soft">
      {/* Desktop image — subject right, dark left for the text.
          No `priority`: on mobile this is display:none (`hidden`), so a priority
          preload would only contend with the real mobile LCP image for bandwidth.
          Lazy ⇒ never downloaded on mobile; on desktop it's in-viewport so the
          browser fetches it eagerly regardless. Mobile is the measured/primary target. */}
      <Image
        src="/images/hero-workshop.webp"
        alt=""
        fill
        sizes="100vw"
        className="hidden sm:block object-cover object-right"
      />
      {/* Mobile image — subject low, dark top for the title. Keeps `priority`
          (preload + fetchpriority=high) since it's the mobile LCP element. */}
      <Image
        src="/images/hero-workshop-mobile.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="sm:hidden object-cover object-center"
      />

      {/* Desktop: left wash anchors the manifesto column on near-black */}
      <div
        className="absolute inset-0 hidden sm:block"
        style={{
          background:
            'linear-gradient(90deg, #09090b 0%, rgba(9,9,11,0.92) 26%, rgba(9,9,11,0.55) 48%, rgba(9,9,11,0.1) 68%, transparent 82%)',
        }}
      />
      {/* Mobile: top wash (title) + bottom wash (subhead + CTAs) */}
      <div
        className="absolute inset-x-0 top-0 h-[46%] sm:hidden"
        style={{ background: 'linear-gradient(180deg, #09090b 0%, rgba(9,9,11,0.82) 36%, transparent 100%)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[52%] sm:hidden"
        style={{ background: 'linear-gradient(0deg, rgba(9,9,11,0.97) 0%, rgba(9,9,11,0.9) 28%, rgba(9,9,11,0.45) 58%, transparent 100%)' }}
      />

      {/* DESKTOP content — single left-aligned, vertically centered block */}
      <div className="absolute inset-0 hidden sm:flex items-center">
        <div className="max-w-6xl mx-auto w-full px-6">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold text-prose-faint uppercase tracking-[0.3em] mb-6">
              Built by a dad · tested by hand
            </p>
            <Manifesto className="text-7xl md:text-8xl" />
            <p className="text-lg text-prose-muted leading-[1.7] max-w-md mt-7">
              {SUBHEAD} <span className="font-bold text-accent">{PROOF}</span>
            </p>
            <div className="flex flex-wrap gap-3 mt-9">
              <Link
                href="/reviews"
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-extrabold text-sm px-7 py-3.5 rounded-xl min-h-[48px] transition-colors"
              >
                Explore Boss Daddy
                <Arrow />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 border border-strong text-prose hover:border-accent hover:text-accent font-bold text-sm px-7 py-3.5 rounded-xl min-h-[48px] transition-colors"
              >
                Who is Boss Daddy?
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE content — split: title top, subhead + CTAs bottom */}
      <div className="absolute inset-0 sm:hidden flex flex-col justify-between px-6 pt-20 pb-10">
        <div>
          <p className="text-[11px] font-bold text-prose-faint uppercase tracking-[0.3em] mb-4">
            Built by a dad · tested by hand
          </p>
          <Manifesto className="text-5xl" />
        </div>
        <div className="[text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
          <p className="text-[15px] text-prose leading-[1.65] mb-6">
            {SUBHEAD}
            <span className="block mt-1.5 font-bold text-accent">{PROOF}</span>
          </p>
          <div className="flex gap-2.5">
            <Link
              href="/reviews"
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-white font-extrabold text-[13px] px-3 py-3.5 rounded-xl min-h-[48px] whitespace-nowrap transition-colors"
            >
              Explore Boss Daddy
              <Arrow />
            </Link>
            <Link
              href="/about"
              className="flex-1 inline-flex items-center justify-center border border-strong text-prose hover:border-accent hover:text-accent font-bold text-[13px] px-3 py-3.5 rounded-xl min-h-[48px] whitespace-nowrap transition-colors"
            >
              Who is Boss Daddy?
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
