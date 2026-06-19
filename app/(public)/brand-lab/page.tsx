'use client'

/* ─────────────────────────────────────────────────────────────────────────
   BRAND LAB — dark-first makeover sandbox (not linked in nav, /brand-lab).
   A throwaway decision surface: flip between manifesto hero treatments and
   accent-orange intensities live, on the REAL dark token system (everything
   is wrapped in data-theme="dark", so every utility resolves to the shipping
   dark palette). Whatever you pick here is what the homepage can become.
   Delete this route once the direction is locked.
   ───────────────────────────────────────────────────────────────────────── */

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

// The only runtime logo (per brand rules). Anchors the logo-led heroes below.
function Logo({ size, className = '' }: { size: number; className?: string }) {
  return (
    <Image
      src="/images/bd-logo-icon.png"
      alt="Boss Daddy"
      width={size}
      height={size}
      priority
      className={`object-contain ${className}`}
    />
  )
}

// ── Manifesto + humble positioning copy (shared across every variant) ───────
const MANIFESTO = ['Real Dads.', 'Smart Tools.', 'Better Decisions.']
const SUBHEAD =
  'Honest reviews, practical guides, and a growing set of tools — built by a dad in the trenches, not a brand chasing clicks.'
const PROOF = 'Zero sponsors. Zero fluff.'

// ── Accent intensities to feel against near-black. Brand is the core; the
//    other two test whether a hotter orange reads better on dark. ───────────
const ACCENTS = [
  { key: 'brand', label: 'Brand', sub: '#CC5500', orange: '#CC5500', hover: '#B85A14', text: '#CC5500' },
  { key: 'hot', label: 'Hot', sub: '#E55A1A', orange: '#E55A1A', hover: '#CC5500', text: '#E55A1A' },
  { key: 'ember', label: 'Ember', sub: '#f48a4a', orange: '#E55A1A', hover: '#CC5500', text: '#f48a4a' },
] as const

const HEROES = [
  { key: 'stamp', label: 'Stamp', sub: 'Centered manifesto' },
  { key: 'command', label: 'Command', sub: 'Tool-forward' },
  { key: 'cinematic', label: 'Cinematic', sub: 'Full-bleed glow' },
  { key: 'grid', label: 'Grid', sub: 'Brutalist / dev-tool' },
  { key: 'split', label: 'Split', sub: 'Two-rhythm' },
  { key: 'crest', label: 'Crest', sub: 'Logo medallion' },
  { key: 'spotlight', label: 'Spotlight', sub: 'Logo + glow' },
  { key: 'lockup', label: 'Lockup', sub: 'Masthead' },
  { key: 'patch', label: 'Patch', sub: 'Wear-it badge' },
  { key: 'photo', label: 'Photo', sub: 'BG image + overlay' },
] as const

type HeroKey = (typeof HEROES)[number]['key']
type AccentKey = (typeof ACCENTS)[number]['key']

// ── Small shared bits ───────────────────────────────────────────────────────
function Manifesto({ className = '', accentLast = true }: { className?: string; accentLast?: boolean }) {
  return (
    <h1 className={`font-black tracking-tight leading-[1.02] ${className}`}>
      {MANIFESTO.map((line, i) => (
        <span
          key={line}
          className={`block ${accentLast && i === MANIFESTO.length - 1 ? 'text-accent' : 'text-prose'}`}
        >
          {line}
        </span>
      ))}
    </h1>
  )
}

function PrimaryCta({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-extrabold text-sm px-7 py-3.5 rounded-xl transition-colors min-h-[44px]">
      {children}
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </span>
  )
}

function GhostCta({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 border border-strong text-prose hover:border-accent hover:text-accent font-bold text-sm px-7 py-3.5 rounded-xl transition-colors min-h-[44px]">
      {children}
    </span>
  )
}

const DOORS = [
  { label: 'Reviews', blurb: 'Field-tested gear', d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4' },
  { label: 'Guides', blurb: 'No-fluff how-tos', d: 'M4 4h10a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z M16 6h4v14H8' },
  { label: 'Tools', blurb: 'Track & decide', d: 'M3 13h4l2 5 4-12 2 7h6' },
  { label: 'The Boss', blurb: 'Ask anything', d: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M8 13a4 4 0 0 0 8 0' },
]

function DoorIcon({ d, className = '' }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split(' M').map((seg, i) => (
        <path key={i} d={(i === 0 ? seg : 'M' + seg)} />
      ))}
    </svg>
  )
}

// ── HERO 1 · STAMP — centered, minimal, lots of black. Linear/Vercel. ───────
function HeroStamp() {
  return (
    <section className="min-h-[88vh] flex flex-col items-center justify-center text-center px-6 py-24">
      <div className="w-12 h-px bg-accent mb-8" />
      <p className="text-[11px] font-bold text-prose-faint uppercase tracking-[0.32em] mb-8">
        Est. 2026 · For dads in the trenches
      </p>
      <Manifesto className="text-5xl sm:text-7xl md:text-8xl" />
      <p className="text-base md:text-lg text-prose-muted leading-[1.7] max-w-2xl mx-auto mt-9">
        {SUBHEAD} <span className="text-prose font-semibold">{PROOF}</span>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
        <PrimaryCta>Explore Boss Daddy</PrimaryCta>
        <GhostCta>Who is Boss Daddy?</GhostCta>
      </div>
    </section>
  )
}

// ── HERO 2 · COMMAND — manifesto + humble "ask" pill + bench proof. Whoop. ──
function HeroCommand() {
  return (
    <section className="min-h-[88vh] flex items-center px-6 py-20">
      <div className="max-w-6xl mx-auto w-full grid lg:grid-cols-[1.3fr_1fr] gap-14 items-center">
        <div>
          <p className="text-[11px] font-bold text-eyebrow uppercase tracking-[0.28em] mb-6">The everyday tool for dads</p>
          <Manifesto className="text-4xl sm:text-6xl md:text-7xl" />
          <p className="text-base md:text-lg text-prose-muted leading-[1.7] max-w-xl mt-7">
            {SUBHEAD} <span className="text-prose font-semibold">{PROOF}</span>
          </p>
          {/* Humble "ask" affordance — a teaser, not an over-promise */}
          <div className="mt-9 flex items-center gap-3 bg-surface border border-soft rounded-2xl px-5 py-4 max-w-xl">
            <svg className="w-5 h-5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-sm text-prose-muted flex-1">Ask the Boss — gear, how-tos, dad life…</span>
            <span className="text-[10px] font-bold text-prose-faint uppercase tracking-wider border border-soft rounded-md px-2 py-1">Beta</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-7">
            <PrimaryCta>Start here</PrimaryCta>
          </div>
        </div>
        {/* Bench proof panel — hands-on credibility */}
        <div className="bg-surface border border-soft rounded-2xl p-6">
          <p className="text-[10px] font-bold text-eyebrow uppercase tracking-[0.2em] mb-5">On the bench · live</p>
          {[
            { n: 'Bottle warmer', s: 'Testing now', c: 'bg-accent' },
            { n: 'Robot mower', s: 'Up next', c: 'bg-prose-faint' },
            { n: 'Cordless drill', s: 'Considering', c: 'bg-prose-faint' },
          ].map((b, i) => (
            <div key={b.n} className={`flex items-center gap-3 py-3.5 ${i < 2 ? 'border-b border-soft' : ''}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${b.c}`} />
              <span className="text-sm font-bold text-prose flex-1">{b.n}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-prose-faint">{b.s}</span>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2 mt-6 pt-5 border-t border-soft">
            {[['40+', 'Reviews'], ['25', 'Guides'], ['4', 'Tools']].map(([n, l]) => (
              <div key={l}>
                <div className="text-xl font-black text-prose tabular-nums">{n}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-prose-faint mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── HERO 3 · CINEMATIC — full-bleed glow, manifesto bottom-left. Hardware. ──
function HeroCinematic() {
  return (
    <section className="relative min-h-[92vh] flex items-end overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 12% 100%, color-mix(in srgb, var(--bd-orange) 26%, transparent) 0%, transparent 55%), linear-gradient(180deg, #09090b 0%, #18181b 100%)',
        }}
      />
      <div className="relative max-w-6xl mx-auto w-full px-6 pb-24 pt-40">
        <div className="flex gap-6">
          <div className="w-1 self-stretch bg-accent rounded-full" />
          <div>
            <p className="text-[11px] font-bold text-prose-faint uppercase tracking-[0.32em] mb-6">
              Built by a dad · tested by hand
            </p>
            <Manifesto className="text-5xl sm:text-7xl md:text-8xl" accentLast={false} />
            <p className="text-base md:text-lg text-prose-muted leading-[1.7] max-w-xl mt-8">
              {SUBHEAD}
            </p>
            <div className="flex flex-wrap gap-3 mt-9">
              <PrimaryCta>Explore Boss Daddy</PrimaryCta>
              <GhostCta>Who is Boss Daddy?</GhostCta>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── HERO 4 · GRID — brutalist / dev-tool. Monospace tag, framed manifesto. ──
function HeroGrid() {
  return (
    <section className="min-h-[88vh] flex items-center px-6 py-20">
      <div className="max-w-5xl mx-auto w-full">
        <p className="font-mono text-xs text-accent mb-6">{'// boss-daddy — v2 — for dads in the trenches'}</p>
        <div className="relative border border-soft rounded-xl p-8 sm:p-12">
          {/* corner ticks */}
          {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((p) => (
            <span key={p} className={`absolute ${p} w-3 h-3 border-accent ${p.includes('top') ? 'border-t-2' : 'border-b-2'} ${p.includes('left') ? 'border-l-2' : 'border-r-2'}`} />
          ))}
          <Manifesto className="text-4xl sm:text-6xl md:text-7xl" />
          <p className="text-base text-prose-muted leading-[1.7] max-w-xl mt-7">
            {SUBHEAD} <span className="text-prose font-semibold">{PROOF}</span>
          </p>
        </div>
        {/* stat ledger */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-x border-b border-soft rounded-b-xl divide-x divide-soft mt-0 overflow-hidden">
          {[['40+', 'Reviews'], ['25', 'Guides'], ['4', 'Tools'], ['$0', 'From sponsors']].map(([n, l]) => (
            <div key={l} className="px-5 py-5">
              <div className="text-2xl font-black text-prose tabular-nums">{n}</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-prose-faint mt-1">{l}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-9">
          <PrimaryCta>Explore Boss Daddy</PrimaryCta>
        </div>
      </div>
    </section>
  )
}

// ── HERO 5 · SPLIT — manifesto left, "inside" tiles right. Two rhythms. ─────
function HeroSplit() {
  return (
    <section className="min-h-[88vh] flex items-center px-6 py-20">
      <div className="max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-14 items-center">
        <div>
          <p className="text-[11px] font-bold text-eyebrow uppercase tracking-[0.28em] mb-6">For dads in the trenches</p>
          <Manifesto className="text-5xl sm:text-7xl" />
          <p className="text-base md:text-lg text-prose-muted leading-[1.7] max-w-md mt-7">
            {SUBHEAD} <span className="text-prose font-semibold">{PROOF}</span>
          </p>
          <div className="flex flex-wrap gap-3 mt-9">
            <PrimaryCta>Start here</PrimaryCta>
            <GhostCta>Who is Boss Daddy?</GhostCta>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-soft border border-soft rounded-2xl overflow-hidden">
          {DOORS.map((door) => (
            <div key={door.label} className="group bg-surface hover:bg-surface-raised transition-colors p-7 flex flex-col gap-3 min-h-[150px]">
              <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
                <DoorIcon d={door.d} className="w-5 h-5" />
              </div>
              <div className="mt-auto">
                <div className="font-black text-prose">{door.label}</div>
                <div className="text-xs text-prose-faint mt-0.5">{door.blurb}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── HERO 6 · CREST — logo in an orange-ringed medallion above manifesto. ───
function HeroCrest() {
  return (
    <section className="min-h-[88vh] flex flex-col items-center justify-center text-center px-6 py-24">
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-surface border-2 border-accent flex items-center justify-center mb-9 shadow-2xl shadow-black/50">
        <Logo size={64} className="w-14 h-14 sm:w-16 sm:h-16" />
      </div>
      <p className="text-[11px] font-bold text-prose-faint uppercase tracking-[0.32em] mb-6">
        Est. 2026 · For dads in the trenches
      </p>
      <Manifesto className="text-5xl sm:text-7xl md:text-8xl" />
      <p className="text-base md:text-lg text-prose-muted leading-[1.7] max-w-2xl mx-auto mt-8">
        {SUBHEAD} <span className="text-prose font-semibold">{PROOF}</span>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
        <PrimaryCta>Explore Boss Daddy</PrimaryCta>
        <GhostCta>Who is Boss Daddy?</GhostCta>
      </div>
    </section>
  )
}

// ── HERO 7 · SPOTLIGHT — the logo IS the hero, lit by a radial glow. ────────
function HeroSpotlight() {
  return (
    <section className="relative min-h-[92vh] flex flex-col items-center justify-center text-center px-6 py-24 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 38%, color-mix(in srgb, var(--bd-orange) 22%, transparent) 0%, transparent 60%), #09090b',
        }}
      />
      <div className="relative">
        <div className="relative inline-flex items-center justify-center mb-10">
          <span
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: 'color-mix(in srgb, var(--bd-orange) 45%, transparent)' }}
          />
          <Logo size={150} className="relative w-28 h-28 sm:w-40 sm:h-40 drop-shadow-2xl" />
        </div>
        <Manifesto className="text-4xl sm:text-6xl md:text-7xl" accentLast={false} />
        <p className="text-base md:text-lg text-prose-muted leading-[1.7] max-w-xl mx-auto mt-7">
          {SUBHEAD}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-9">
          <PrimaryCta>Explore Boss Daddy</PrimaryCta>
        </div>
      </div>
    </section>
  )
}

// ── HERO 8 · LOCKUP — masthead: logo + wordmark, then manifesto. ────────────
function HeroLockup() {
  return (
    <section className="min-h-[88vh] flex items-center px-6 py-20">
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-4 pb-8 border-b border-soft">
          <div className="w-14 h-14 rounded-2xl bg-surface border border-soft flex items-center justify-center shrink-0">
            <Logo size={36} className="w-9 h-9" />
          </div>
          <div>
            <div className="font-black text-prose text-lg tracking-tight leading-none">
              BOSS <span className="text-accent">DADDY</span>
            </div>
            <div className="text-[10px] font-bold text-prose-faint uppercase tracking-[0.28em] mt-1.5">
              For dads in the trenches
            </div>
          </div>
        </div>
        <Manifesto className="text-5xl sm:text-7xl md:text-8xl mt-10" />
        <p className="text-base md:text-lg text-prose-muted leading-[1.7] max-w-2xl mt-8">
          {SUBHEAD} <span className="text-prose font-semibold">{PROOF}</span>
        </p>
        <div className="flex flex-wrap gap-3 mt-9">
          <PrimaryCta>Explore Boss Daddy</PrimaryCta>
          <GhostCta>Who is Boss Daddy?</GhostCta>
        </div>
      </div>
    </section>
  )
}

// ── HERO 9 · PATCH — logo as a stitched merch patch ("wear it" nod). ────────
function HeroPatch() {
  return (
    <section className="min-h-[88vh] flex flex-col items-center justify-center text-center px-6 py-24">
      {/* Dashed ring = stitching; ties the mark to the merch/private-label ambition */}
      <div className="relative w-32 h-32 sm:w-36 sm:h-36 mb-10">
        <span className="absolute inset-0 rounded-full bg-surface border border-soft" />
        <span className="absolute inset-2 rounded-full border-2 border-dashed border-accent/70" />
        <span className="absolute inset-0 flex items-center justify-center">
          <Logo size={72} className="w-16 h-16 sm:w-[72px] sm:h-[72px]" />
        </span>
      </div>
      <p className="text-[11px] font-bold text-prose-faint uppercase tracking-[0.32em] mb-6">
        A brand you&apos;d wear · built to be earned
      </p>
      <Manifesto className="text-5xl sm:text-7xl" />
      <p className="text-base md:text-lg text-prose-muted leading-[1.7] max-w-2xl mx-auto mt-8">
        {SUBHEAD} <span className="text-prose font-semibold">{PROOF}</span>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
        <PrimaryCta>Explore Boss Daddy</PrimaryCta>
        <GhostCta>Who is Boss Daddy?</GhostCta>
      </div>
    </section>
  )
}

// ── HERO 10 · PHOTO — real workshop shot. DESKTOP: subject right, text in the
//    dark-left column. MOBILE: subject is centered low, so the copy is SPLIT —
//    title pinned to the top dark band, subhead + CTAs pinned to the bottom —
//    framing the dad between them instead of overlapping his face. ───────────
function HeroPhoto({ zoom = 1, focus = 'mid' }: { zoom?: number; focus?: string } = {}) {
  const originY = focus === 'top' ? '22%' : focus === 'low' ? '60%' : '40%'
  return (
    <section className="relative min-h-[92vh] overflow-hidden">
      {/* Desktop image — wide shot, subject right, dark left for the text */}
      <Image
        src="/images/hero-workshop.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="hidden sm:block object-cover object-right"
      />
      {/* Mobile image — portrait shot. zoom/focus are live-tunable in the Lab;
          transform scales from the chosen vertical anchor so the subject stays
          framed while the side-crop tightens or loosens. */}
      <Image
        src="/images/hero-workshop-mobile.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="sm:hidden object-cover object-center"
        style={{ transform: `scale(${zoom})`, transformOrigin: `50% ${originY}` }}
      />

      {/* Desktop: left wash anchors the manifesto column on near-black */}
      <div
        className="absolute inset-0 hidden sm:block"
        style={{
          background:
            'linear-gradient(90deg, #09090b 0%, rgba(9,9,11,0.92) 26%, rgba(9,9,11,0.55) 48%, rgba(9,9,11,0.1) 68%, transparent 82%)',
        }}
      />
      {/* Mobile: top wash (for the title) + bottom wash (for the CTA) */}
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
              <PrimaryCta>Explore Boss Daddy</PrimaryCta>
              <GhostCta>Who is Boss Daddy?</GhostCta>
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
            <span className="flex-1 inline-flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-white font-extrabold text-[13px] px-3 py-3.5 rounded-xl min-h-[48px] whitespace-nowrap transition-colors">
              Explore Boss Daddy
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
            <span className="flex-1 inline-flex items-center justify-center border border-strong text-prose hover:border-accent hover:text-accent font-bold text-[13px] px-3 py-3.5 rounded-xl min-h-[48px] whitespace-nowrap transition-colors">
              Who is Boss Daddy?
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

const HERO_MAP: Record<HeroKey, (props?: { zoom?: number; focus?: string }) => React.JSX.Element> = {
  stamp: HeroStamp,
  command: HeroCommand,
  cinematic: HeroCinematic,
  grid: HeroGrid,
  split: HeroSplit,
  crest: HeroCrest,
  spotlight: HeroSpotlight,
  lockup: HeroLockup,
  patch: HeroPatch,
  photo: HeroPhoto,
}

// ── Palette reference strip — always visible at the bottom ───────────────────
function PaletteStrip() {
  const swatches = [
    ['#09090b', 'zinc-950', 'Canvas'],
    ['#18181b', 'zinc-900', 'Surface'],
    ['#27272a', 'zinc-800', 'Raised'],
    ['#3f3f46', 'zinc-700', 'Edge'],
    ['#f4f4f5', 'zinc-100', 'Text'],
    ['var(--bd-orange)', 'orange', 'Accent'],
  ]
  return (
    <section className="border-t border-soft px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <p className="text-[11px] font-bold text-eyebrow uppercase tracking-[0.2em] mb-5">Dark-first palette</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {swatches.map(([hex, name, role]) => (
            <div key={name} className="rounded-xl border border-soft overflow-hidden">
              <div className="h-16" style={{ background: hex }} />
              <div className="p-3 bg-surface">
                <div className="text-xs font-bold text-prose">{role}</div>
                <div className="font-mono text-[10px] text-prose-faint mt-0.5">{name}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function BrandLabPage() {
  const [hero, setHero] = useState<HeroKey>('photo')
  const [accent, setAccent] = useState<AccentKey>('hot')
  const [photoZoom, setPhotoZoom] = useState('1')
  const [photoFocus, setPhotoFocus] = useState('mid')
  const Hero = HERO_MAP[hero]
  const acc = ACCENTS.find((a) => a.key === accent)!

  return (
    <div
      data-theme="dark"
      className="bg-background text-prose min-h-screen"
      style={
        {
          '--bd-orange': acc.orange,
          '--bd-orange-hover': acc.hover,
          '--bd-orange-text': acc.text,
        } as React.CSSProperties
      }
    >
      {/* ── Control bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-surface/95 backdrop-blur border-b border-soft">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="text-[11px] font-black text-prose uppercase tracking-[0.2em] mr-2">Brand Lab</span>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-prose-faint uppercase tracking-wider">Hero</span>
            <div className="flex flex-wrap gap-1">
              {HEROES.map((h) => (
                <button
                  key={h.key}
                  onClick={() => setHero(h.key)}
                  title={h.sub}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                    hero === h.key
                      ? 'bg-accent border-accent text-white'
                      : 'border-soft text-prose-muted hover:border-strong'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-prose-faint uppercase tracking-wider">Accent</span>
            <div className="flex gap-1">
              {ACCENTS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAccent(a.key)}
                  title={a.sub}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                    accent === a.key ? 'border-accent text-prose' : 'border-soft text-prose-muted hover:border-strong'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full" style={{ background: a.text }} />
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <Link href="/" className="ml-auto text-xs font-bold text-prose-faint hover:text-accent transition-colors">
            ← Live site
          </Link>
        </div>

        {/* Photo-only mobile framing controls (visible on phones to tune live) */}
        {hero === 'photo' && (
          <div className="max-w-6xl mx-auto px-6 pb-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-faint pt-3 sm:hidden">
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Mobile only</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-prose-faint uppercase tracking-wider">Zoom</span>
              <div className="flex gap-1">
                {[['1', 'Fit'], ['1.2', 'In'], ['1.45', 'In++']].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setPhotoZoom(v)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                      photoZoom === v ? 'bg-accent border-accent text-white' : 'border-soft text-prose-muted'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-prose-faint uppercase tracking-wider">Focus</span>
              <div className="flex gap-1">
                {[['top', 'High'], ['mid', 'Mid'], ['low', 'Low']].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setPhotoFocus(v)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                      photoFocus === v ? 'bg-accent border-accent text-white' : 'border-soft text-prose-muted'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {hero === 'photo' ? (
        <HeroPhoto zoom={Number(photoZoom)} focus={photoFocus} />
      ) : (
        <Hero key={hero} />
      )}
      <PaletteStrip />

      <div className="px-6 py-10 text-center border-t border-soft">
        <p className="text-xs text-prose-faint max-w-xl mx-auto leading-relaxed">
          Sandbox only — not linked in nav. Flip Hero + Accent above; everything renders on the real
          dark token system. Tell me which hero + accent to take to the live homepage.
        </p>
      </div>
    </div>
  )
}
