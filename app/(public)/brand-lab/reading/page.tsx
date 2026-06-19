'use client'

/* ─────────────────────────────────────────────────────────────────────────
   READING LAB — /brand-lab/reading. A faithful dark-theme review article for
   judging long-form readability BEFORE committing the dark rollout. Toggle
   the reading surface (elevated panel vs full-bleed canvas), the body size,
   and serif vs sans. Renders the REAL .bd-editorial prose styles + the real
   ScoreBlock / BossApprovedBadge components in a data-theme="dark" scope, so
   what you read here is what ships. Sandbox only — delete with /brand-lab.
   ───────────────────────────────────────────────────────────────────────── */

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ScoreBlock from '@/components/ScoreBlock'
import BossApprovedBadge from '@/components/BossApprovedBadge'

type Surface = 'auto' | 'panel' | 'canvas'
type Size = 'cozy' | 'comfort' | 'large'

function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-prose-faint uppercase tracking-wider">{label}</span>
      <div className="flex gap-1">
        {options.map(([v, l]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
              value === v ? 'bg-accent border-accent text-white' : 'border-soft text-prose-muted hover:border-strong'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ReadingLab() {
  const [surface, setSurface] = useState<Surface>('auto')
  const [size, setSize] = useState<Size>('comfort')
  const [serif, setSerif] = useState(false)

  const bodyPx = size === 'cozy' ? 16 : size === 'large' ? 20 : 18

  // Auto = panel below lg (phone + tablet, no framing margin), canvas at lg+
  // (true desktop, where the wide dark margins frame the column themselves).
  const surfaceClass =
    surface === 'panel'
      ? 'bg-surface border border-soft rounded-2xl p-5 sm:p-10 shadow-2xl shadow-black/40'
      : surface === 'canvas'
        ? ''
        : 'bg-surface border border-soft rounded-2xl p-5 sm:p-8 shadow-2xl shadow-black/40 lg:bg-transparent lg:border-0 lg:rounded-none lg:p-0 lg:shadow-none'

  return (
    <div
      data-theme="dark"
      className="bg-background text-prose min-h-screen"
      style={{ '--bd-orange': '#E55A1A', '--bd-orange-hover': '#CC5500', '--bd-orange-text': '#f48a4a' } as React.CSSProperties}
    >
      {/* ── Control bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-surface/95 backdrop-blur border-b border-soft">
        <div className="max-w-5xl mx-auto px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="text-[11px] font-black text-prose uppercase tracking-[0.2em] mr-1">Reading Lab</span>
          <Toggle label="Surface" value={surface} options={[['auto', 'Auto'], ['panel', 'Panel'], ['canvas', 'Canvas']]} onChange={setSurface} />
          <Toggle label="Size" value={size} options={[['cozy', 'Cozy'], ['comfort', 'Comfort'], ['large', 'Large']]} onChange={setSize} />
          <Toggle label="Type" value={serif ? 'serif' : 'sans'} options={[['serif', 'Serif'], ['sans', 'Sans']]} onChange={(v) => setSerif(v === 'serif')} />
          <Link href="/brand-lab" className="ml-auto text-xs font-bold text-prose-faint hover:text-accent transition-colors">
            ← Brand Lab
          </Link>
        </div>
      </div>

      {/* ── Article ─────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-10 sm:py-14">
        <article className={`max-w-2xl mx-auto ${surfaceClass}`}>
          {/* Eyebrow + title + meta */}
          <p className="text-[11px] text-eyebrow uppercase tracking-[0.2em] font-bold">Power Tools · Review</p>
          <h1 className="font-black text-prose text-3xl sm:text-5xl leading-[1.08] tracking-tight mt-3">
            The Cordless Drill I Reach For First on Every Weekend Project
          </h1>
          <div className="flex items-center gap-3 mt-5 text-sm text-prose-faint">
            <span className="font-semibold text-prose-muted">By Boss Daddy</span>
            <span aria-hidden>·</span>
            <span>Jun 18, 2026</span>
            <span aria-hidden>·</span>
            <span>7 min read</span>
          </div>

          {/* Score + Boss Approved */}
          <div className="flex items-center gap-6 mt-7 pb-7 border-b border-soft">
            <ScoreBlock rating={9.2} size="md" />
            <div className="border-l-2 border-soft pl-6">
              <p className="text-sm text-prose-muted leading-relaxed max-w-sm">
                Tough, balanced, and it just keeps going. After three months of real use, this is the one
                I hand a buddy when he asks what to buy.
              </p>
            </div>
            <div className="ml-auto hidden sm:block">
              <BossApprovedBadge size="lg" />
            </div>
          </div>

          {/* Hero image — framed */}
          <figure className="my-7">
            <div className="relative w-full h-56 sm:h-80 rounded-xl overflow-hidden border border-soft">
              <Image src="/images/hero-workshop.webp" alt="" fill className="object-cover" sizes="(max-width:768px) 100vw, 700px" />
            </div>
            <figcaption className="text-xs text-prose-faint mt-2 italic text-center">
              Three months on the bench — and on actual projects.
            </figcaption>
          </figure>

          {/* Body */}
          <div
            className={serif ? 'bd-editorial' : ''}
            style={{ fontSize: bodyPx, lineHeight: 1.78 }}
          >
            <p className="text-prose mb-5">
              I&apos;ve burned through enough cheap drills to know the difference between a tool that
              survives a weekend and one that becomes a paperweight by spring. This one earns its spot in
              the bag. I bought it with my own money, ran it hard for three months, and it never once made
              me wish I&apos;d grabbed something else.
            </p>
            <p className="text-prose mb-5">
              If you&apos;re a dad who fixes the fence, hangs the shelves, and assembles the stuff that
              shows up in a flat box at 9 p.m. — this is the honest rundown, no sponsor breathing down my
              neck.
            </p>

            <h2 className="font-black text-prose text-2xl sm:text-3xl leading-tight mt-9 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              What it gets right
            </h2>
            <p className="text-prose mb-5">
              The balance is the headline. Most drills in this range feel front-heavy and start to fight you
              overhead. This one sits in the hand like it was measured for it, and the grip texture doesn&apos;t
              get slick when your palms do. Torque is more than enough for anything a homeowner throws at it.
            </p>

            {/* Self-styled so it renders in both Sans and Serif modes; the
                serif inside is the editorial-warmth accent we'd keep at rollout. */}
            <blockquote className="my-6 border-l-[3px] border-accent bg-surface-raised rounded-r-lg py-3 px-5">
              <p className="italic text-prose" style={{ fontFamily: 'var(--font-editorial)', fontSize: '1.05em' }}>
                Three months in, the battery still holds a full afternoon of work. That alone puts it ahead
                of every budget drill I&apos;ve owned.
              </p>
            </blockquote>

            <h3 className="font-bold text-prose text-xl leading-tight mt-7 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              The little things
            </h3>
            <ul className="list-disc pl-5 mb-5 space-y-2 text-prose marker:text-accent">
              <li>The LED actually lights the hole, not the ceiling.</li>
              <li>Clutch settings are easy to read and hold their detents.</li>
              <li>Belt clip is metal, not the snap-off plastic everyone else uses.</li>
            </ul>

            <p className="text-prose mb-5">
              Is it perfect? No. The case is the usual molded afterthought, and I&apos;d have liked a second
              battery in the box at this price. But those are quibbles against a tool that does the job every
              single time.
            </p>

            {/* Spec comparison table */}
            <h3 className="font-bold text-prose text-xl leading-tight mt-7 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              How it stacks up
            </h3>
            <div className="overflow-x-auto -mx-1 my-5">
              <table className="w-full text-sm border-collapse" style={{ fontFamily: 'var(--font-sans)' }}>
                <thead>
                  <tr className="border-b border-strong text-left">
                    <th className="py-2.5 pr-4 font-bold text-prose-muted">Spec</th>
                    <th className="py-2.5 px-3 font-bold text-accent">This drill</th>
                    <th className="py-2.5 px-3 font-bold text-prose-muted">Budget pick</th>
                  </tr>
                </thead>
                <tbody className="text-prose">
                  {[
                    ['Torque', '550 in-lbs', '320 in-lbs'],
                    ['Battery life', 'Full afternoon', '~2 hours'],
                    ['Weight', '2.4 lbs', '2.9 lbs'],
                    ['Warranty', '5 years', '1 year'],
                  ].map((row, i) => (
                    <tr key={row[0]} className={`border-b border-soft ${i % 2 ? 'bg-surface-raised/40' : ''}`}>
                      <td className="py-2.5 pr-4 text-prose-muted">{row[0]}</td>
                      <td className="py-2.5 px-3 font-semibold">{row[1]}</td>
                      <td className="py-2.5 px-3 text-prose-muted">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Simulated white-background product shot — shows the "glowing
                rectangle" problem and the frame treatment that tames it */}
            <figure className="my-7">
              <div className="rounded-xl overflow-hidden border border-soft bg-surface-raised p-6 flex items-center justify-center">
                <div className="w-full h-40 rounded-lg bg-zinc-200 flex items-center justify-center text-zinc-500 text-sm">
                  (white-background product photo)
                </div>
              </div>
              <figcaption className="text-xs text-prose-faint mt-2 italic text-center">
                White-bg product shots get a frame + padded surface so they don&apos;t glare on dark.
              </figcaption>
            </figure>

            <p className="text-prose mb-2">
              Bottom line: if you want one drill that handles 95% of what a busy dad needs and won&apos;t quit
              on you mid-project, this is the buy. It&apos;s the one I reach for first.
            </p>
          </div>

          {/* Buy CTA card */}
          <div className="mt-8 bg-surface-raised border border-soft rounded-2xl p-5 sm:p-6">
            <p className="text-[11px] text-eyebrow uppercase tracking-widest font-bold">Where to buy</p>
            <h3 className="font-black text-prose text-lg mt-1.5">The drill from this review</h3>
            <button className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-extrabold text-sm px-7 py-3.5 rounded-xl min-h-[48px] transition-colors">
              Check price
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <p className="text-xs text-prose-muted mt-4 leading-relaxed">
              As an Amazon Associate, Boss Daddy earns from qualifying purchases. This doesn&apos;t cost you
              anything extra and never changes our verdict.
            </p>
          </div>
        </article>

        <p className="text-center text-xs text-prose-faint mt-10 max-w-lg mx-auto leading-relaxed">
          Sandbox — toggle Surface / Size / Type above. Body, headings, links, blockquote, table, score,
          badge, and CTA all render on the real dark token system.
        </p>
      </div>
    </div>
  )
}
