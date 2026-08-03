import { Fragment } from 'react'
import { BRAND } from '@/lib/brand'

/**
 * The mid-directory breather — a single restrained line dropped between topic
 * blocks on the homepage Library, `/guides`, and `/reviews`.
 *
 * Two jobs. It breaks a very long run of identical modules (the Library is ~3,500px
 * of one repeated shape), and it puts the credibility line where trust is actually
 * being decided — mid-browse — instead of only in the hero and the footer, where it
 * decorates rather than persuades. brand-guide §1.7 names reviews AND guides as
 * primary usage contexts for this line.
 *
 * WHY IT HAS NO CARD: every other thing in these sections is a bordered card, so
 * the absence of one is the strongest differentiation available, and it's free. Don't
 * "finish" this by wrapping it in a panel — the bare treatment IS the pause.
 *
 * WHY IT ISN'T BIG TYPE: brand-guide §359 specs the credibility line as *supporting*
 * type — small-to-mid, body/UI weight, explicitly NOT `font-black`. So the breath
 * comes from vertical air, not from type size. Resist promoting it to a display line.
 *
 * Also deliberately NOT here, all of which were tempting:
 *   - `bg-clip-text` gradient — dark→white gradients are a documented dark-canvas
 *     anti-pattern; they read as a rendering bug on a near-black page.
 *   - `text-shadow` — nothing sits behind this, so a shadow is invisible cost.
 *   - `font-editorial-display` (Fraunces) — reserved for editorial DISPLAY moments
 *     (section titles, PageHeader H1s, the Creed). This is a supporting line; serif
 *     would promote it into competition with the block headers around it.
 *   - `font-black` — §359 forbids it for this line specifically.
 *
 * WHY IT HAS NO LINK: the section header above already carries "All guides →". A CTA
 * here would turn the breather back into a module, which defeats it. The Creed takes
 * the same approach.
 *
 * Imports BRAND itself rather than taking the line as a prop, so the three surfaces
 * can't drift apart.
 */
/**
 * "Real Dads. Smart Tools. Better Decisions." is three two-word beats, and setting it
 * as one wrapped sentence throws that away — the parallel structure IS the line's
 * rhythm. Split on the sentence periods so each beat can be placed.
 *
 * Derived from the canonical string rather than hardcoded, so a wording change in
 * lib/brand.ts still renders. Falls back to one plain line if the string ever stops
 * being multi-sentence — better a flat render than a broken one.
 */
function beats(line: string): { lead: string; last: string }[] {
  const sentences = line.split('.').map((s) => s.trim()).filter(Boolean)
  if (sentences.length < 2) return []
  return sentences.map((s) => {
    const i = s.lastIndexOf(' ')
    return i === -1 ? { lead: '', last: s } : { lead: s.slice(0, i), last: s.slice(i + 1) }
  })
}

export default function CredibilityBreak() {
  const lines = beats(BRAND.credibility)

  if (lines.length === 0) {
    return (
      <div className="mt-12 pt-12 border-t border-soft">
        <p className="py-10 md:py-14 text-center text-base md:text-xl font-bold uppercase tracking-[0.14em] text-prose">
          {BRAND.credibility}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-12 pt-12 border-t border-soft">
      {/* Presence comes from WIDTH, not point size. Set in a max-w-xl column this
          line read as a stray paragraph adrift in a 1152px section; uppercase and
          tracked out across the full measure it reads as a deliberate trust bar,
          while the type stays mid-size and UI-weight per §359.
          One DOM, layout adapts: stacked on mobile (narrow measure), one horizontal
          rank from `sm` up. Don't split this into duplicated per-breakpoint blocks —
          the sentence would appear twice in the DOM for no structural reason. */}
      <div className="py-10 md:py-14 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 sm:gap-0 text-center">
        {lines.map(({ lead, last }, i) => (
          <Fragment key={last}>
            {i > 0 && (
              // Accent dot separators — the same dot that kickers use on LeadCard and
              // LibraryGuideCard, so the accent vocabulary stays consistent. Hidden on
              // mobile, where the stack already separates the beats.
              <span
                aria-hidden
                className="hidden sm:block shrink-0 w-1.5 h-1.5 rounded-full bg-accent mx-5 md:mx-8"
              />
            )}
            <span className="text-base md:text-xl font-bold uppercase tracking-[0.14em] text-prose whitespace-nowrap">
              {lead && `${lead} `}{last}.
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
