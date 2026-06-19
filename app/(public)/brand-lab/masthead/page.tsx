'use client'

/* ─────────────────────────────────────────────────────────────────────────
   MASTHEAD LAB — /brand-lab/masthead. Header treatments for the dark-first
   identity, designed AFTER the decision that "Ask the Boss" lives as its own
   concierge layer (FAB + mobile bottom-nav slot + contextual entries) — so
   the masthead no longer carries an AI button. Each preview shows the header
   PLUS the AI FAB and a mobile bottom-nav mock for full context. Visual only.
   Sandbox — delete with /brand-lab.
   ───────────────────────────────────────────────────────────────────────── */

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const VARIANTS = [
  { key: 'clean', label: 'Clean ⌘K', sub: 'Recommended — nav + visible search, no AI button' },
  { key: 'omnibox', label: 'Omnibox', sub: 'Wide centered search as the hero' },
  { key: 'twotier', label: 'Two-Tier', sub: 'Utilities row + nav tabs' },
  { key: 'minimal', label: 'Minimal', sub: 'Stripped, premium, lots of air' },
  { key: 'editorial', label: 'Editorial', sub: 'Current — search as an icon' },
] as const
type VariantKey = (typeof VARIANTS)[number]['key']

const NAV = ['Reviews', 'Guides', 'Gear', 'Tools']

// ── Shared pieces ───────────────────────────────────────────────────────────
function Logo() {
  return (
    <span className="flex items-center gap-2 font-black text-xl tracking-tight shrink-0">
      <Image src="/images/bd-logo-icon.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" />
      <span><span className="text-accent">BOSS</span><span className="text-prose"> DADDY</span></span>
    </span>
  )
}

function Chevron() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function NavLinks() {
  return (
    <nav className="hidden md:flex items-center gap-1">
      {NAV.map((l, i) => (
        <span key={l} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          i === 0 ? 'bg-accent text-white' : 'text-prose-muted hover:text-prose hover:bg-surface-raised'
        }`}>{l}</span>
      ))}
      <span className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-prose-muted hover:text-prose hover:bg-surface-raised">
        Browse <Chevron />
      </span>
    </nav>
  )
}

const SEARCH_ICON = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
function SearchPill({ wide = false }: { wide?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 bg-surface-raised border border-strong rounded-lg text-prose-faint ${wide ? 'px-4 py-2.5 w-full' : 'px-3 py-1.5'}`}>
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={SEARCH_ICON} />
      </svg>
      <span className="text-sm flex-1 text-left">{wide ? 'Search reviews, guides, gear, tools…' : 'Search'}</span>
      <kbd className="text-[10px] font-mono bg-surface-hover border border-strong rounded px-1.5 py-0.5 leading-none">⌘K</kbd>
    </span>
  )
}

function IconBtn({ d }: { d: string }) {
  return (
    <span className="p-2 rounded-lg text-prose-muted hover:text-prose hover:bg-surface-raised inline-flex">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      </svg>
    </span>
  )
}
const CART = 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 2.3M17 13l2 2M9 19a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z'
const BELL = 'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1'
const CHAT = 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'

function UserChip() {
  return (
    <span className="flex items-center gap-2 p-1 pr-3 rounded-full bg-surface-raised">
      <span className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white">B</span>
      <span className="text-sm text-prose-muted hidden sm:inline">@boss</span>
    </span>
  )
}

// ── Masthead variants (no AI button — Ask the Boss is the FAB/bottom-nav) ────
function Clean() {
  return (
    <header className="bg-chrome border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Logo />
        <NavLinks />
        <div className="flex items-center gap-1.5">
          <span className="hidden md:inline-flex"><SearchPill /></span>
          <IconBtn d={CART} />
          <IconBtn d={BELL} />
          <UserChip />
        </div>
      </div>
    </header>
  )
}

function Omnibox() {
  return (
    <header className="bg-chrome border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
        <Logo />
        <span className="hidden md:flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-prose-muted hover:text-prose hover:bg-surface-raised shrink-0">
          Browse <Chevron />
        </span>
        <div className="flex-1 max-w-xl"><SearchPill wide /></div>
        <div className="flex items-center gap-1">
          <IconBtn d={CART} />
          <IconBtn d={BELL} />
        </div>
        <UserChip />
      </div>
    </header>
  )
}

function TwoTier() {
  return (
    <header className="bg-chrome border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <Logo />
        <div className="flex-1 max-w-md hidden md:block"><SearchPill wide /></div>
        <div className="flex items-center gap-1">
          <IconBtn d={CART} /><IconBtn d={BELL} /><UserChip />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 h-11 flex items-center gap-6 border-t border-faint overflow-x-auto scrollbar-hide">
        {['Reviews', 'Guides', 'Gear', 'Tools', 'Comparisons', 'Vault'].map((l, i) => (
          <span key={l} className={`text-sm font-semibold h-full flex items-center border-b-2 whitespace-nowrap ${
            i === 0 ? 'text-accent border-accent' : 'text-prose-muted border-transparent hover:text-prose'
          }`}>{l}</span>
        ))}
      </div>
    </header>
  )
}

function Minimal() {
  return (
    <header className="bg-chrome border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-7">
          {NAV.map((l, i) => (
            <span key={l} className={`text-sm font-semibold ${i === 0 ? 'text-accent' : 'text-prose-muted hover:text-prose'}`}>{l}</span>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <IconBtn d={SEARCH_ICON} />
          <span className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white">B</span>
        </div>
      </div>
    </header>
  )
}

function Editorial() {
  return (
    <header className="bg-chrome border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />
        <NavLinks />
        <div className="flex items-center gap-1">
          <IconBtn d={SEARCH_ICON} />
          <IconBtn d={CART} />
          <IconBtn d={BELL} />
          <UserChip />
        </div>
      </div>
    </header>
  )
}

const MAP: Record<VariantKey, () => React.JSX.Element> = {
  clean: Clean, omnibox: Omnibox, twotier: TwoTier, minimal: Minimal, editorial: Editorial,
}

// ── The AI concierge presence shown alongside every masthead ────────────────
function AskBossFab() {
  return (
    <div className="fixed bottom-6 right-6 z-40 hidden md:flex items-center gap-2.5">
      <span className="bg-surface border border-soft rounded-full px-3.5 py-2 text-xs font-bold text-prose shadow-xl shadow-black/40">
        Ask the Boss
      </span>
      <span className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center shadow-xl shadow-black/40 ring-4 ring-accent/20">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={CHAT} />
        </svg>
      </span>
    </div>
  )
}

function MobileBottomNavMock() {
  const tabs = [
    { label: 'Home', d: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { label: 'Reviews', d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
    { label: 'Ask', d: CHAT, center: true },
    { label: 'Gear', d: 'M3 13h4l2 5 4-12 2 7h6' },
    { label: 'You', d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ]
  return (
    <div className="max-w-xs mx-auto">
      <div className="bg-chrome border border-soft rounded-2xl px-1.5 py-1.5 flex items-end justify-around shadow-xl shadow-black/40">
        {tabs.map((t) => t.center ? (
          <span key={t.label} className="flex flex-col items-center -mt-5">
            <span className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center shadow-lg ring-4 ring-background">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={t.d} /></svg>
            </span>
            <span className="text-[9px] font-bold text-accent mt-1">{t.label}</span>
          </span>
        ) : (
          <span key={t.label} className="flex flex-col items-center gap-1 px-2 py-1.5 text-prose-faint">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={t.d} /></svg>
            <span className="text-[9px] font-medium">{t.label}</span>
          </span>
        ))}
      </div>
      <p className="text-center text-[11px] text-prose-faint mt-2">Mobile bottom nav — Ask the Boss in the center slot</p>
    </div>
  )
}

export default function MastheadLab() {
  const [variant, setVariant] = useState<VariantKey>('clean')
  const Masthead = MAP[variant]
  const meta = VARIANTS.find((v) => v.key === variant)!

  return (
    <div className="bg-background min-h-screen">
      <div className="sticky top-0 z-50 bg-surface/95 backdrop-blur border-b border-soft">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[11px] font-black text-prose uppercase tracking-[0.2em] mr-1">Masthead Lab</span>
          <div className="flex flex-wrap gap-1">
            {VARIANTS.map((v) => (
              <button key={v.key} onClick={() => setVariant(v.key)} title={v.sub}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                  variant === v.key ? 'bg-accent border-accent text-white' : 'border-soft text-prose-muted hover:border-strong'
                }`}>{v.label}</button>
            ))}
          </div>
          <Link href="/brand-lab" className="ml-auto text-xs font-bold text-prose-faint hover:text-accent transition-colors">← Brand Lab</Link>
        </div>
      </div>

      <Masthead />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-[11px] font-bold text-accent uppercase tracking-[0.2em]">{meta.label} masthead · mockup</p>
        <p className="text-sm text-prose-faint mt-1 mb-8">
          {meta.sub}. Ask the Boss lives in the FAB (bottom-right) + the mobile bottom-nav center slot below — not the header.
        </p>

        <div className="mb-12"><MobileBottomNavMock /></div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border border-soft rounded-xl overflow-hidden">
              <div className="h-28 bg-surface-raised" />
              <div className="p-3.5">
                <div className="h-2.5 w-16 bg-surface-hover rounded mb-2" />
                <div className="h-3 w-full bg-surface-raised rounded mb-1.5" />
                <div className="h-3 w-3/4 bg-surface-raised rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-8 text-center border-t border-soft">
        <p className="text-xs text-prose-faint max-w-lg mx-auto leading-relaxed">
          Toggle the treatments above. The real header still sits at the very top of the page; these are previews.
          Tell me which masthead to take live (or mix elements).
        </p>
      </div>

      <AskBossFab />
    </div>
  )
}
