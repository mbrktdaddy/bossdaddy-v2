'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getCategoryBySlug } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'

export interface Candidate {
  id:        string
  slug:      string
  title:     string
  subtitle:  string | null
  category:  string | null
  rating:    number | null
  image_url: string | null
  featured:  boolean
  top_pick:  boolean
}

export interface SiteSettings {
  homepage_hero_type: 'review' | 'guide' | null
  homepage_hero_id:   string | null
}

interface Props {
  reviews:  Candidate[]
  guides:   Candidate[]
  settings: SiteSettings
}

type Zone = 'hero' | 'featured-review' | 'featured-guide' | 'top-pick'

export function SpotlightsClient({ reviews, guides, settings }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyZone, setBusyZone] = useState<Zone | null>(null)
  const [error, setError] = useState<string | null>(null)

  const featuredReview = reviews.find((r) => r.featured) ?? null
  const featuredGuide  = guides.find((g) => g.featured) ?? null
  const topPickReview  = reviews.find((r) => r.top_pick) ?? null

  async function call(zone: Zone, fn: () => Promise<Response>) {
    setBusyZone(zone)
    setError(null)
    try {
      const res = await fn()
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Request failed (${res.status})`)
        return
      }
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setBusyZone(null)
    }
  }

  function setFeaturedReview(id: string | null) {
    void call('featured-review', () =>
      id === null
        ? fetch(`/api/admin/reviews/${featuredReview?.id}/feature`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ featured: false }),
          })
        : fetch(`/api/admin/reviews/${id}/feature`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ featured: true }),
          })
    )
  }

  function setTopPick(id: string | null) {
    void call('top-pick', () =>
      id === null
        ? fetch(`/api/admin/reviews/${topPickReview?.id}/top-pick`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ is_top_pick: false }),
          })
        : fetch(`/api/admin/reviews/${id}/top-pick`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ is_top_pick: true }),
          })
    )
  }

  function setFeaturedGuide(id: string | null) {
    void call('featured-guide', () =>
      id === null
        ? fetch(`/api/admin/guides/${featuredGuide?.id}/feature`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ featured: false }),
          })
        : fetch(`/api/admin/guides/${id}/feature`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ featured: true }),
          })
    )
  }

  function setHero(type: 'review' | 'guide' | null, id: string | null) {
    void call('hero', () =>
      fetch('/api/admin/site-settings/homepage-hero', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(
          type === null
            ? { homepage_hero_type: null, homepage_hero_id: null }
            : { homepage_hero_type: type, homepage_hero_id: id }
        ),
      })
    )
  }

  const heroResolved =
    settings.homepage_hero_type === 'review'
      ? reviews.find((r) => r.id === settings.homepage_hero_id) ?? null
      : settings.homepage_hero_type === 'guide'
        ? guides.find((g) => g.id === settings.homepage_hero_id) ?? null
        : null

  return (
    <div className="space-y-10">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Homepage Hero — polymorphic (review OR guide OR auto) ────────── */}
      <Zone
        title="Homepage Hero"
        hint={`The singular marquee on /. ${heroResolved ? `Currently overridden — pointing at the ${settings.homepage_hero_type} below.` : 'On Auto — uses the Featured Review (or falls back to the highest-rated review when nothing is featured).'}`}
        busy={busyZone === 'hero' || pending}
        current={
          heroResolved
            ? { type: settings.homepage_hero_type!, item: heroResolved }
            : featuredReview
              ? { type: 'review', item: featuredReview, auto: true }
              : null
        }
        onClear={heroResolved ? () => setHero(null, null) : null}
        clearLabel="Return to Auto"
      >
        <ZoneTabs
          reviews={reviews}
          guides={guides}
          selectedId={settings.homepage_hero_id}
          selectedType={settings.homepage_hero_type}
          onSelectReview={(id) => setHero('review', id)}
          onSelectGuide={(id) => setHero('guide', id)}
          allowBoth
        />
      </Zone>

      {/* ── Featured Review — drives /reviews top card ───────────────────── */}
      <Zone
        title="Featured Review"
        hint="Drives the Featured Review card at the top of /reviews. Also serves as the Auto homepage hero when no override is set."
        busy={busyZone === 'featured-review' || pending}
        current={featuredReview ? { type: 'review', item: featuredReview } : null}
        onClear={featuredReview ? () => setFeaturedReview(null) : null}
      >
        <CandidateList
          items={reviews}
          selectedId={featuredReview?.id ?? null}
          onSelect={(id) => setFeaturedReview(id)}
        />
      </Zone>

      {/* ── Featured Guide — drives /guides top card ─────────────────────── */}
      <Zone
        title="Featured Guide"
        hint="Drives the Featured Guide card at the top of /guides. Can also be set as the Homepage Hero above."
        busy={busyZone === 'featured-guide' || pending}
        current={featuredGuide ? { type: 'guide', item: featuredGuide } : null}
        onClear={featuredGuide ? () => setFeaturedGuide(null) : null}
      >
        <CandidateList
          items={guides}
          selectedId={featuredGuide?.id ?? null}
          onSelect={(id) => setFeaturedGuide(id)}
        />
      </Zone>

      {/* ── Boss's #1 Pick — all-time champion, drives /gear ──────────────── */}
      <Zone
        title="Boss's #1 Pick"
        hint="The all-time champion — drives the '#1 Pick' slot at the top of /gear. Change rarely; this is the single product you'd recommend over all others."
        busy={busyZone === 'top-pick' || pending}
        current={topPickReview ? { type: 'review', item: topPickReview } : null}
        onClear={topPickReview ? () => setTopPick(null) : null}
      >
        <CandidateList
          items={reviews}
          selectedId={topPickReview?.id ?? null}
          onSelect={(id) => setTopPick(id)}
        />
      </Zone>
    </div>
  )
}

interface ZoneProps {
  title:       string
  hint:        string
  busy:        boolean
  current:     { type: 'review' | 'guide'; item: Candidate; auto?: boolean } | null
  onClear:     (() => void) | null
  clearLabel?: string
  children:    React.ReactNode
}

function Zone({ title, hint, busy, current, onClear, clearLabel = 'Clear', children }: ZoneProps) {
  return (
    <section className="rounded-xl border border-soft/60 bg-surface overflow-hidden">
      <header className="px-5 py-4 border-b border-soft/60 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-black text-prose">{title}</h2>
          <p className="text-xs text-prose-faint mt-1 leading-relaxed">{hint}</p>
          {current && (
            <p className="text-xs text-accent-text-soft mt-2 font-semibold">
              Currently: <span className="text-prose font-normal">{current.item.title}</span>
              <span className="text-prose-faint font-normal"> · {current.type}{current.auto ? ' · Auto' : ''}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {busy && <span className="text-xs text-prose-faint animate-pulse">Saving…</span>}
          {onClear && (
            <button
              onClick={onClear}
              disabled={busy}
              className="text-xs text-prose-faint hover:text-prose font-medium px-2 py-1 rounded transition-colors disabled:opacity-50"
            >
              {clearLabel}
            </button>
          )}
        </div>
      </header>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  )
}

interface ZoneTabsProps {
  reviews:        Candidate[]
  guides:         Candidate[]
  selectedId:     string | null
  selectedType:   'review' | 'guide' | null
  onSelectReview: (id: string) => void
  onSelectGuide:  (id: string) => void
  allowBoth:      boolean
}

function ZoneTabs({ reviews, guides, selectedId, selectedType, onSelectReview, onSelectGuide }: ZoneTabsProps) {
  const [tab, setTab] = useState<'review' | 'guide'>(selectedType ?? 'review')
  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setTab('review')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'review' ? 'bg-accent text-white' : 'bg-surface-raised text-prose-muted hover:text-prose'
          }`}
        >
          Review
        </button>
        <button
          onClick={() => setTab('guide')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'guide' ? 'bg-accent text-white' : 'bg-surface-raised text-prose-muted hover:text-prose'
          }`}
        >
          Guide
        </button>
      </div>
      <CandidateList
        items={tab === 'review' ? reviews : guides}
        selectedId={selectedType === tab ? selectedId : null}
        onSelect={tab === 'review' ? onSelectReview : onSelectGuide}
      />
    </div>
  )
}

interface CandidateListProps {
  items:      Candidate[]
  selectedId: string | null
  onSelect:   (id: string) => void
}

function CandidateList({ items, selectedId, onSelect }: CandidateListProps) {
  const [query, setQuery] = useState('')
  const filtered = query.trim()
    ? items.filter((i) =>
        (i.title + ' ' + (i.subtitle ?? '')).toLowerCase().includes(query.trim().toLowerCase())
      )
    : items

  return (
    <div>
      {items.length > 8 && (
        <input
          type="search"
          placeholder="Filter by title or product name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full mb-3 px-3 py-2 bg-surface-raised border border-soft rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
        />
      )}
      {filtered.length === 0 ? (
        <p className="text-sm text-prose-faint py-6 text-center">No matches.</p>
      ) : (
        <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
          {filtered.map((item) => {
            const cat = item.category ? getCategoryBySlug(item.category) : null
            const selected = item.id === selectedId
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${
                  selected
                    ? 'bg-accent-tint border border-accent-border/40'
                    : 'bg-surface-raised/40 hover:bg-surface-raised border border-transparent'
                }`}
              >
                <span
                  className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selected ? 'border-accent bg-accent' : 'border-prose-faint'
                  }`}
                >
                  {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                {item.image_url ? (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-surface shrink-0">
                    <Image src={item.image_url} alt="" fill className="object-cover" sizes="40px" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-surface shrink-0 flex items-center justify-center">
                    {cat && <CategoryIcon slug={cat.slug} className="w-4 h-4 text-accent-text/60" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-prose truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {cat && (
                      <span className="flex items-center gap-1 text-[10px] text-eyebrow uppercase tracking-widest font-semibold">
                        <CategoryIcon slug={cat.slug} className="w-3 h-3 text-accent-text" />
                        {cat.label}
                      </span>
                    )}
                    {item.subtitle && <span className="text-xs text-prose-faint truncate">{item.subtitle}</span>}
                  </div>
                </div>
                {item.rating != null && (
                  <span className="shrink-0 text-xs font-bold tabular-nums text-accent-text-soft">
                    {item.rating.toFixed(1)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
