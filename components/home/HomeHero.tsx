import Image from 'next/image'
import Link from 'next/link'

/* Homepage full-bleed Photo hero — Manifesto v2 (docs/home-manifesto-spec.md).
   DESKTOP: wide workshop shot, subject right, manifesto in the dark-left column.
   MOBILE: portrait shot, subject low — copy sits over top+bottom washes.
   A live-number ticker pins to the bottom edge (reviews/guides/tools counts +
   the "Zero paid placements" independence line — all real, DB-backed).
   Accent = Hot orange. Swap the placeholder art for the hero shoot later:
   only the two <Image src> values change. */

const SUBHEAD =
  'Field-tested gear, no-fluff guides, and free tools for men who show up every day. If it can’t survive my house, it doesn’t get a score.'

function Headline({ className = '' }: { className?: string }) {
  return (
    <h1 className={`font-black tracking-tight leading-[0.98] text-prose ${className}`}>
      Dad like a <br className="sm:hidden" /><span className="text-accent">BOSS.</span>
    </h1>
  )
}

const Arrow = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
)

interface TickerStat {
  n: string
  label: string
}

function Ticker({ stats }: { stats: TickerStat[] }) {
  return (
    <div className="relative z-10 border-t border-white/12 bg-chrome/45 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 py-4 text-[13px] font-semibold text-prose-muted sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-2">
          {stats.map((s) => (
            <li key={s.label} className="inline-flex items-center gap-2">
              <span className="text-accent" aria-hidden>●</span>
              <span className="font-black text-prose tabular-nums">{s.n}</span>
              {s.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

interface Props {
  reviewCount: number
  guidesCount: number
  toolsCount: number
}

export default function HomeHero({ reviewCount, guidesCount, toolsCount }: Props) {
  const stats: TickerStat[] = [
    { n: String(reviewCount), label: 'gear tested' },
    { n: String(guidesCount), label: 'guides published' },
    { n: String(toolsCount), label: 'free tools' },
    { n: '0', label: 'paid placements' },
  ]

  return (
    <section className="relative min-h-[80svh] sm:min-h-[88vh] flex flex-col overflow-hidden border-b border-soft">
      {/* Desktop image — subject right, dark left for the text. Lazy: it's
          display:none on mobile, where the portrait crop is the real LCP. */}
      <Image
        src="/images/hero-workshop.webp"
        alt=""
        fill
        sizes="100vw"
        className="hidden sm:block object-cover object-right"
      />
      {/* Mobile image — subject low in the source (top ~half is empty wall), so
          we zoom + anchor to the bottom to lift the man into the clear middle
          band of the split (between the top title and the bottom CTAs). Tune
          `scale-*` to taste; re-crop for the real hero shoot. `priority` = LCP. */}
      <Image
        src="/images/hero-workshop-mobile.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="sm:hidden object-cover object-center scale-[1.35] origin-bottom -translate-y-[5%]"
      />

      {/* Desktop wash — anchors the left manifesto column on near-black */}
      <div
        className="absolute inset-0 hidden sm:block"
        style={{
          background:
            'linear-gradient(90deg, #09090b 0%, rgba(9,9,11,0.92) 26%, rgba(9,9,11,0.55) 48%, rgba(9,9,11,0.1) 68%, transparent 82%)',
        }}
      />
      {/* Hot glow, top-right, matches the mock */}
      <div
        className="absolute inset-0 hidden sm:block pointer-events-none"
        style={{ background: 'radial-gradient(120% 90% at 74% 16%, rgba(229,90,26,0.20), transparent 55%)' }}
      />
      {/* Mobile washes — top (title) + bottom (subhead + CTAs + ticker) */}
      <div
        className="absolute inset-x-0 top-0 h-[42%] sm:hidden"
        style={{ background: 'linear-gradient(180deg, #09090b 0%, rgba(9,9,11,0.82) 36%, transparent 100%)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[58%] sm:hidden"
        style={{ background: 'linear-gradient(0deg, rgba(9,9,11,0.97) 0%, rgba(9,9,11,0.9) 30%, rgba(9,9,11,0.4) 62%, transparent 100%)' }}
      />

      {/* DESKTOP content — bottom-anchored manifesto block */}
      <div className="relative z-10 hidden sm:flex flex-1 items-end">
        <div className="max-w-6xl mx-auto w-full px-6 pb-14">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold text-eyebrow uppercase tracking-[0.28em] mb-5">
              Real dads · Zero paid placements · Bought with my own money
            </p>
            <Headline className="text-7xl md:text-[5.5rem]" />
            <p className="text-lg text-prose-muted leading-[1.6] max-w-xl mt-6">
              {SUBHEAD}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/reviews"
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-extrabold text-sm px-7 py-3.5 rounded-xl min-h-[48px] transition-colors"
              >
                Browse the reviews
                <Arrow />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 border border-strong text-prose hover:border-accent hover:text-accent font-bold text-sm px-7 py-3.5 rounded-xl min-h-[48px] transition-colors"
              >
                Meet the Boss
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE content — Option B: tighter split (title top / CTAs bottom, shorter hero) */}
      <div className="relative z-10 sm:hidden flex flex-1 flex-col justify-between px-6 pt-10 pb-7">
        <div className="text-center">
          <p className="text-[11px] font-bold text-eyebrow uppercase tracking-[0.24em] mb-4">
            Zero paid placements
          </p>
          <Headline className="text-5xl" />
        </div>
        <div className="text-center [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
          <p className="text-[15px] text-prose leading-[1.6] mb-6">{SUBHEAD}</p>
          <div className="flex flex-col gap-2.5">
            <Link
              href="/about"
              className="w-full inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-extrabold text-sm px-6 py-3.5 rounded-xl min-h-[48px] transition-colors"
            >
              Meet the Boss
              <Arrow />
            </Link>
          </div>
        </div>
      </div>

      <Ticker stats={stats} />
    </section>
  )
}
