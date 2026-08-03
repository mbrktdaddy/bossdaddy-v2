import Image from 'next/image'
import { Fragment } from 'react'
import { BRAND } from '@/lib/brand'

/**
 * The mid-directory breather — dropped between topic blocks on the homepage Library,
 * `/guides`, and `/reviews`.
 *
 * Two jobs. It breaks a very long run of identical modules (the Library is ~3,500px
 * of one repeated shape), and it puts the credibility line where trust is actually
 * being decided — mid-browse — instead of only in the hero and the footer, where it
 * decorates rather than persuades. brand-guide §1.7 names reviews AND guides as
 * primary usage contexts for this line.
 *
 * DESIGN HISTORY, so it isn't re-litigated. This went through three treatments:
 *   1. A bare centred line, no card, on the theory that "everything else here is a
 *      bordered card, so the absence of one is the strongest differentiation." That
 *      did not survive being looked at — it read as a stray paragraph.
 *   2. A neutral banded strip with outline icons per beat. Better, still generic —
 *      it looked like a SaaS feature row.
 *   3. This: a photo band. Chosen from thirteen rendered directions.
 *
 * Why the photo wins where type could not: brand-guide §359 pins this line to
 * *supporting* type — small-to-mid, UI weight, explicitly NOT `font-black`. So the
 * treatment can never get presence from the type itself. Imagery sidesteps that
 * entirely: the art carries the weight, the type stays restrained, doctrine holds.
 *
 * The art is doing a specific job, so don't swap it casually: `credibility-texture.webp`
 * is a 2.5:1 macro with warm light entering from the left and a deliberately DEAD BLACK
 * centre. That empty centre is why the scrim can sit at 35% — a heavier scrim would
 * flatten the art to a grey rectangle and we'd be paying 58KB for nothing. Any
 * replacement needs the same dark middle or the copy stops being legible.
 *
 * Deliberately absent, all of which were tried or tempting:
 *   - A dark→white gradient scrim — that's the documented dark-canvas anti-pattern. A
 *     flat black scrim over a photo is a different thing and is correct here.
 *   - `bg-accent/10` icon chips — pale-orange fills are forbidden; warmth lives in
 *     border, icon, and text, never a tinted background.
 *   - `font-editorial-display` (Fraunces) — reserved for editorial DISPLAY moments
 *     (section titles, PageHeader H1s, the Creed). Serif here would compete with the
 *     topic-block headers either side of it.
 *   - An `on={'background'|'surface'}` prop — the other shared cards need one so they
 *     don't vanish into a same-coloured section, but a photo band supplies its own
 *     contrast on any surface.
 */

/**
 * "Real Dads. Smart Tools. Better Decisions." is three two-word beats, and setting it
 * as one wrapped sentence throws that away — the parallel structure IS the line's
 * rhythm. Split on the sentence periods so each beat can be placed.
 *
 * Derived from the canonical string rather than hardcoded, so a wording change in
 * lib/brand.ts still renders. Falls back to one plain line if the string ever stops
 * being multi-sentence — better a flat render than a broken rank.
 */
function beats(line: string): string[] {
  return line.split('.').map((s) => s.trim()).filter(Boolean)
}

export default function CredibilityBreak() {
  const lines = beats(BRAND.credibility)

  return (
    <div className="mt-12 pt-12 border-t border-soft">
      <div className="relative rounded-2xl overflow-hidden border border-soft min-h-[220px] md:min-h-[260px] flex items-center">
        <Image
          src="/images/credibility-texture.webp"
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 1100px"
          className="object-cover"
        />
        <div aria-hidden className="absolute inset-0 bg-black/35" />

        {/* text-shadow here is legibility over a photograph, NOT elevation — the
            copy is centred over the dark middle, but at narrow widths the block
            reaches toward the lit left edge. Same reason HomeHero carries one. */}
        <div className="relative w-full px-5 sm:px-6 py-12 text-center [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          {/* No eyebrow. There was a "The standard" kicker here; removed on request.
              The band is a statement, not a titled section — and with the copy alone
              the art gets more room to read. Don't reinstate a kicker without a reason:
              `positioning` is already the hero eyebrow, so a literal one here would be
              a third brand-line occurrence on a single page. */}
          {lines.length < 2 ? (
            <p className="text-sm sm:text-base md:text-xl font-bold uppercase tracking-[0.12em] sm:tracking-[0.14em] text-white">
              {BRAND.credibility}
            </p>
          ) : (
            /* Mobile wraps 2 + 1 — the leading beats share a line and the closing one
               drops beneath it. Three separate stacked lines read as a bulleted list
               rather than one statement.
               Mobile type and padding tighten (text-sm, tighter tracking, px-5, closer
               dots) because at `text-base` the first two beats plus their separator
               overflow a 320px screen and it silently falls back to three lines. */
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:gap-x-0 sm:gap-y-0">
              {lines.map((beat, i) => {
                const isLast = i === lines.length - 1
                return (
                  <Fragment key={beat}>
                    {i > 0 && (
                      // Accent dot separators — the same dot the kickers on LeadCard
                      // and LibraryGuideCard use, keeping the accent vocabulary
                      // consistent. The one before the closing beat hides on mobile,
                      // where the line break separates them instead.
                      <span
                        aria-hidden
                        className={`${isLast ? 'hidden sm:block' : 'block'} shrink-0 w-1.5 h-1.5 rounded-full bg-accent mx-2 sm:mx-6`}
                      />
                    )}
                    {/* Zero-height full-basis spacer forces the wrap before the closing
                        beat on mobile only. Cheaper and more robust than hardcoding a
                        2-then-1 grouping, which would break if the line's beat count
                        ever changed. */}
                    {isLast && <span aria-hidden className="basis-full h-0 sm:hidden" />}
                    <p
                      className={`text-sm sm:text-base md:text-xl font-bold uppercase tracking-[0.12em] sm:tracking-[0.14em] whitespace-nowrap ${
                        // Closing beat in accent — it's the payoff of the three, and on
                        // dark the *text* orange (orange-400) is the right token: the
                        // primary #E55A1A is a fill colour and next to white it reads
                        // as recessed rather than emphasised.
                        isLast ? 'text-accent-text' : 'text-white'
                      }`}
                    >
                      {beat}.
                    </p>
                  </Fragment>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
